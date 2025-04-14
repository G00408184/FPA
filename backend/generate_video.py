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
        current_dir = os.path.dirname(os.path.abspath(__file__))
        frames_folder = os.path.join(current_dir, frames_folder)
        output_path = os.path.join(current_dir, output_path)
        temp_path = os.path.join(current_dir, temp_path)
        uploads_dir = os.path.join(current_dir, "uploads")

        # Clean up any existing files
        for path in [output_path, temp_path]:
            if os.path.exists(path):
                os.remove(path)

        # Get all frame files and sort them properly
        frame_files = [
            f
            for f in os.listdir(frames_folder)
            if f.startswith("frame_") and f.endswith(".jpg")
        ]
        if not frame_files:
            print("❌ Error: No frames found.")
            return False

        # Sort frames by their number
        frame_files.sort(key=lambda x: int(x.split("_")[1].split(".")[0]))
        print(f"Found {len(frame_files)} frames")

        # Analyze original video
        original_fps, original_frame_count = analyze_original_video(uploads_dir)

        if original_fps is None:
            fps = 30
            print("⚠️ Could not analyze original video, using default FPS: 30")
        else:
            fps = original_fps

            # Verify frame count matches approximately
            if abs(len(frame_files) - original_frame_count) > 5:
                print(
                    f"⚠️ Warning: Frame count mismatch! Original: {original_frame_count}, Current: {len(frame_files)}"
                )

            print(f"✅ Using original video FPS: {fps}")

        # Get size from the first frame
        first_frame_path = os.path.join(frames_folder, frame_files[0])
        first_frame = cv2.imread(first_frame_path)
        if first_frame is None:
            print(f"❌ Error: Cannot read {first_frame_path}")
            return False
        height, width = first_frame.shape[:2]

        # Try different codecs with exact settings
        codecs = [
            ("avc1", ".mp4"),  # H.264
            ("h264", ".mp4"),  # Alternative H.264
            ("mp4v", ".mp4"),  # MP4V
        ]

        success = False
        for codec, ext in codecs:
            try:
                fourcc = cv2.VideoWriter_fourcc(*codec)
                out = cv2.VideoWriter(temp_path, fourcc, fps, (width, height))
                if out.isOpened():
                    success = True
                    print(f"✅ Successfully opened video writer with codec: {codec}")
                    break
                out.release()
            except Exception as e:
                print(f"❌ Failed with codec {codec}: {str(e)}")
                continue

        if not success:
            print("❌ Could not initialize video writer with any codec")
            return False

        print(f"🎞️ Generating video with {len(frame_files)} frames at {fps} FPS...")

        # Process frames in batches
        total_batches = (len(frame_files) + batch_size - 1) // batch_size
        last_valid_frame = None

        for batch_idx in range(total_batches):
            start_idx = batch_idx * batch_size
            end_idx = min(start_idx + batch_size, len(frame_files))
            batch_files = frame_files[start_idx:end_idx]

            print(
                f"Processing batch {batch_idx + 1}/{total_batches} ({len(batch_files)} frames)"
            )

            # Load and process batch
            for frame_file in tqdm(batch_files, desc=f"Batch {batch_idx + 1}"):
                frame_path = os.path.join(frames_folder, frame_file)
                frame = cv2.imread(frame_path)

                if frame is None:
                    if last_valid_frame is not None:
                        frame = last_valid_frame.copy()
                    else:
                        continue
                else:
                    # Ensure frame is in BGR color space
                    if len(frame.shape) == 2:  # If grayscale
                        frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
                    elif frame.shape[2] == 4:  # If RGBA
                        frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)

                    # Resize if needed
                    if frame.shape[:2] != (height, width):
                        frame = cv2.resize(frame, (width, height))

                    last_valid_frame = frame.copy()

                out.write(frame)

                # Clear memory
                del frame

            # Force memory cleanup after each batch
            import gc

            gc.collect()

        out.release()
        print("✅ Initial video writing completed")

        # Verify temp video was created
        if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
            print("❌ Error: Failed to create temporary video file")
            return False

        # Post-process with FFmpeg using exact timing settings
        try:
            print("🔄 Post-processing with FFmpeg...")
            ffmpeg_cmd = [
                "ffmpeg",
                "-y",
                "-i",
                temp_path,
                "-c:v",
                "libx264",
                "-preset",
                "slow",  # Use slower preset for better quality
                "-crf",
                "17",  # Even higher quality
                "-pix_fmt",
                "yuv420p",  # Better compatibility
                "-movflags",
                "+faststart",  # Web playback optimization
                "-tune",
                "film",  # Optimize for film-like content
                "-profile:v",
                "high",  # High profile for better quality
                "-level",
                "4.1",  # Compatibility level
                "-vsync",
                "cfr",  # Constant frame rate for smoother playback
                "-r",
                str(fps),  # Explicitly set frame rate
                "-max_muxing_queue_size",
                "9999",  # Prevent muxing errors
                "-af",
                "aresample=async=1:min_hard_comp=0.100000",  # Better audio sync
                output_path,
            ]
            subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
            print("✅ FFmpeg processing completed")

            # Verify final video
            if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
                raise Exception("FFmpeg output file is missing or empty")

        except Exception as e:
            print(f"⚠️ FFmpeg processing failed: {str(e)}")
            print("↪️ Falling back to original video...")
            shutil.move(temp_path, output_path)
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)

        print(f"✅ Video saved to: {output_path}")
        print(f"🕒 Duration: {len(frame_files) / fps:.2f} seconds")
        return True

    except Exception as e:
        print(f"❌ Error during video generation: {str(e)}")
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
