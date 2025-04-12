import cv2
import os
import argparse


def generate_video(
    frames_folder="processed_frames", output_path="output_video.mp4", fps=60
):
    """
    Generate a video from frames in a directory.

    Args:
        frames_folder (str): Path to folder containing frames
        output_path (str): Path where the output video will be saved
        fps (int): Frames per second for the output video
    """
    # Ensure frames_folder is relative to the backend directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    frames_folder = os.path.join(current_dir, frames_folder)
    output_path = os.path.join(current_dir, output_path)

    # Get list of all processed frames and sort them numerically
    frames = sorted(
        [f for f in os.listdir(frames_folder) if f.endswith(".jpg")],
        key=lambda x: int(x.split("_")[1].split(".")[0]),
    )

    if not frames:
        print("Error: No frames found in the specified directory.")
        return

    print(f"Found {len(frames)} frames")
    print(f"Frame number range: {frames[0]} to {frames[-1]}")

    # Read the first frame to get video properties
    first_frame_path = os.path.join(frames_folder, frames[0])
    first_frame = cv2.imread(first_frame_path)
    if first_frame is None:
        print(f"Error: Could not read frame at {first_frame_path}")
        return
    height, width, _ = first_frame.shape

    print(f"Frame dimensions: {width}x{height}")
    print(f"Output FPS: {fps}")

    # Define video writer with high quality settings
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")  # MPEG-4 codec
    video_writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    print("Generating video...")

    # Add frames to the video
    for i, frame_name in enumerate(frames):
        frame_path = os.path.join(frames_folder, frame_name)
        frame = cv2.imread(frame_path)
        if frame is None:
            print(f"Warning: Could not read frame at {frame_path}")
            continue
        video_writer.write(frame)
        if (i + 1) % 50 == 0:  # Show progress every 50 frames
            print(
                f"Processed {i + 1}/{len(frames)} frames ({(i+1)/len(frames)*100:.1f}%)"
            )

    # Release the video writer
    video_writer.release()
    print(f"Video generated successfully at: {output_path}")
    print(f"Duration: {len(frames)/fps:.2f} seconds")


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
        help="Path for output video (default: output_video.mp4)",
    )
    parser.add_argument(
        "--fps", type=int, default=60, help="Frames per second (default: 60)"
    )

    args = parser.parse_args()

    generate_video(args.frames, args.output, args.fps)
