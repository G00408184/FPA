import cv2
import os
import argparse
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from tqdm import tqdm
import subprocess
import shutil
import time
import sys


def load_frame(frame_path, width, height):
    """Load and resize a single frame with error handling"""
    try:
        frame = cv2.imread(frame_path)
        if frame is None:
            print(f"Warning: Could not read frame at {frame_path}")
            return None

        # Ensure frame is in BGR color space
        if len(frame.shape) == 2:  # If grayscale
            frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        elif frame.shape[2] == 4:  # If RGBA
            frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)

        # Resize if needed
        if frame.shape[:2] != (height, width):
            frame = cv2.resize(frame, (width, height))

        return frame
    except Exception as e:
        print(f"Error loading frame {frame_path}: {str(e)}")
        return None


def analyze_original_video(uploads_dir):
    """Analyze the original video to get exact frame timings"""
    try:
        video_files = [
            f
            for f in os.listdir(uploads_dir)
            if f.endswith((".mp4", ".avi", ".mov", ".mkv"))
        ]
        if not video_files:
            return None, None

        # Get the most recently modified video file
        original_video = max(
            [os.path.join(uploads_dir, f) for f in video_files], key=os.path.getmtime
        )
        cap = cv2.VideoCapture(original_video)

        if not cap.isOpened():
            return None, None

        # Get basic video properties
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0

        print(f"Original video stats:")
        print(f"- FPS: {fps}")
        print(f"- Frame count: {frame_count}")
        print(f"- Duration: {duration:.2f} seconds")

        cap.release()
        return fps, frame_count

    except Exception as e:
        print(f"Error analyzing original video: {str(e)}")
        return None, None


def generate_video(
    frames_folder="processed_frames",
    output_path="output_video.mp4",
    temp_path="temp_output.mp4",
    fps=None,  # Make fps optional
    batch_size=50,  # Process frames in batches
):
    """
    Generate a video from frames in a directory with FFmpeg post-processing.
    Now matches the original video's timing exactly.
    """
    try:
        # Get absolute paths for all files and directories
        current_dir = os.path.dirname(os.path.abspath(__file__))
        print(f"Current directory: {current_dir}")

        frames_folder = os.path.join(current_dir, frames_folder)
        output_path = os.path.join(current_dir, output_path)
        temp_path = os.path.join(current_dir, temp_path)
        uploads_dir = os.path.join(current_dir, "uploads")

        print(f"Frames folder path: {frames_folder}")
        print(f"Output path: {output_path}")
        print(f"Temp path: {temp_path}")
        print(f"Uploads directory: {uploads_dir}")

        # Verify that the frames directory exists
        if not os.path.exists(frames_folder):
            print(f"[ERROR] Frames folder does not exist: {frames_folder}")
            return False

        # Clean up any existing files
        for path in [output_path, temp_path]:
            if os.path.exists(path):
                print(f"Removing existing file: {path}")
                os.remove(path)

        # Get all frame files and sort them properly
        try:
            all_files = os.listdir(frames_folder)
            print(
                f"All files in frames folder ({len(all_files)} files): {all_files[:5]}..."
            )

            frame_files = [
                f for f in all_files if f.startswith("frame_") and f.endswith(".jpg")
            ]
        except Exception as e:
            print(f"[ERROR] Error listing directory {frames_folder}: {str(e)}")
            return False

        if not frame_files:
            print("[ERROR] No frames found.")
            return False

        # Sort frames by their number
        frame_files.sort(key=lambda x: int(x.split("_")[1].split(".")[0]))
        print(f"Found {len(frame_files)} frames, first 5: {frame_files[:5]}")

        # Analyze original video
        original_fps, original_frame_count = analyze_original_video(uploads_dir)

        if original_fps is None:
            fps = 30
            print("[WARNING] Could not analyze original video, using default FPS: 30")
        else:
            fps = original_fps

            # Verify frame count matches approximately
            if abs(len(frame_files) - original_frame_count) > 5:
                print(
                    f"[WARNING] Frame count mismatch! Original: {original_frame_count}, Current: {len(frame_files)}"
                )

            print(f"[OK] Using original video FPS: {fps}")

        # Get size from the first frame
        first_frame_path = os.path.join(frames_folder, frame_files[0])
        print(f"Reading first frame from: {first_frame_path}")

        first_frame = cv2.imread(first_frame_path)
        if first_frame is None:
            print(f"[ERROR] Cannot read {first_frame_path}")
            # Try a different frame as a fallback
            if len(frame_files) > 1:
                alternative_frame_path = os.path.join(frames_folder, frame_files[1])
                print(f"Trying alternative frame: {alternative_frame_path}")
                first_frame = cv2.imread(alternative_frame_path)
                if first_frame is None:
                    print(f"[ERROR] Cannot read alternative frame either")
                    return False
            else:
                return False

        height, width = first_frame.shape[:2]
        print(f"Frame dimensions: {width}x{height}")

        # Try different codecs with exact settings
        codecs = [
            ("XVID", ".mp4"),  # XVID - Try this first as it's most compatible
            ("mp4v", ".mp4"),  # MP4V
            ("avc1", ".mp4"),  # H.264
            ("h264", ".mp4"),  # Alternative H.264
        ]

        success = False
        for codec, ext in codecs:
            try:
                print(f"Trying codec: {codec}")
                fourcc = cv2.VideoWriter_fourcc(*codec)
                out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
                if out.isOpened():
                    success = True
                    print(f"[OK] Successfully opened video writer with codec: {codec}")
                    break
                out.release()
            except Exception as e:
                print(f"[ERROR] Failed with codec {codec}: {str(e)}")
                continue

        if not success:
            print("[ERROR] Could not initialize video writer with any codec")
            return False

        print(
            f"[VIDEO] Generating video with {len(frame_files)} frames at {fps} FPS..."
        )

        # Process frames in batches
        total_batches = (len(frame_files) + batch_size - 1) // batch_size
        last_valid_frame = None
        frames_written = 0

        for batch_idx in range(total_batches):
            start_idx = batch_idx * batch_size
            end_idx = min(start_idx + batch_size, len(frame_files))
            batch_files = frame_files[start_idx:end_idx]

            print(
                f"Processing batch {batch_idx + 1}/{total_batches} ({len(batch_files)} frames)"
            )

            # Load and process batch
            for frame_file in batch_files:
                frame_path = os.path.join(frames_folder, frame_file)
                frame = cv2.imread(frame_path)

                if frame is None:
                    print(f"[WARNING] Could not read frame {frame_path}")
                    if last_valid_frame is not None:
                        frame = last_valid_frame.copy()
                        print(f"Using previous frame as fallback")
                    else:
                        print(f"Skipping frame (no valid previous frame)")
                        continue
                else:
                    # Ensure frame is in BGR color space
                    if len(frame.shape) == 2:  # If grayscale
                        frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
                    elif frame.shape[2] == 4:  # If RGBA
                        frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)

                    # Resize if needed
                    if frame.shape[:2] != (height, width):
                        print(
                            f"Resizing frame from {frame.shape[:2]} to {height, width}"
                        )
                        frame = cv2.resize(frame, (width, height))

                    last_valid_frame = frame.copy()

                out.write(frame)
                frames_written += 1

                # Clear memory
                del frame

            # Force memory cleanup after each batch
            import gc

            gc.collect()

        out.release()
        print(f"[OK] Video writing completed, wrote {frames_written} frames")

        # Verify output file was created
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(
                f"Output file created: {output_path}, size: {file_size / (1024*1024):.2f} MB"
            )

            # Copy the file to the parent directory to make it easier to find
            try:
                parent_dir = os.path.dirname(current_dir)
                parent_output_path = os.path.join(parent_dir, "output_video.mp4")
                print(f"Copying video file to parent directory: {parent_output_path}")
                shutil.copy2(output_path, parent_output_path)
                print(f"Successfully copied video to: {parent_output_path}")
            except Exception as copy_error:
                print(
                    f"Warning: Could not copy video to parent directory: {str(copy_error)}"
                )
                # Continue anyway since we still have the original file
        else:
            print(f"[ERROR] Output file was not created: {output_path}")
            return False

        print(f"[OK] Video saved to: {output_path}")
        print(f"[TIME] Duration: {len(frame_files) / fps:.2f} seconds")
        return True

    except Exception as e:
        print(f"[ERROR] Error during video generation: {str(e)}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate video from frames")
    parser.add_argument(
        "--frames",
        type=str,
        default="processed_frames",
        help="Path to folder containing frames (default: processed_frames)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="output_video.mp4",
        help="Output video path (default: output_video.mp4)",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=None,
        help="Frames per second (default: None, will try to detect from original video)",
    )

    args = parser.parse_args()
    success = generate_video(args.frames, args.output, "temp_" + args.output, args.fps)
    if not success:
        sys.exit(1)
