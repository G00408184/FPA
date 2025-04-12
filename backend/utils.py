def save_video(frames, output_path):
    """Save frames as a video file"""
    if not frames:
        return

    height, width = frames[0].shape[:2]
    fourcc = cv2.VideoWriter_fourcc(*"XVID")
    out = cv2.VideoWriter(output_path, fourcc, 25.0, (width, height))

    for frame in frames:
        out.write(frame)

    out.release()
