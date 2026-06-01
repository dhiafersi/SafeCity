import argparse
from pathlib import Path

from ultralytics import YOLO


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run YOLOv8 debug detection and save an annotated anomaly image."
    )
    parser.add_argument("image", help="Path to the anomaly image to analyze.")
    parser.add_argument(
        "--model",
        default="runs/best.pt",
        help="YOLO model path. Defaults to runs/best.pt.",
    )
    parser.add_argument(
        "--conf",
        default=0.25,
        type=float,
        help="Confidence threshold. Defaults to 0.25.",
    )
    parser.add_argument(
        "--out",
        default="debug-output",
        help="Directory where the annotated image is saved.",
    )
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    output_dir = Path(args.out)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 72)
    print("SafeCity Connect - YOLOv8 Debug Console")
    print("=" * 72)
    print(f"Model: {args.model}")
    print(f"Image: {image_path.resolve()}")
    print(f"Confidence threshold: {args.conf}")

    model = YOLO(args.model)
    results = model.predict(
        source=str(image_path),
        conf=args.conf,
        imgsz=640,
        save=True,
        project=str(output_dir),
        name="yolo-detections",
        exist_ok=True,
        verbose=True,
    )

    result = results[0]
    print("-" * 72)
    print(f"Detected objects: {len(result.boxes)}")

    if len(result.boxes) == 0:
        print("No anomaly was detected by YOLOv8.")
    else:
        for index, box in enumerate(result.boxes, start=1):
            class_id = int(box.cls.item())
            label = result.names[class_id]
            confidence = float(box.conf.item())
            x1, y1, x2, y2 = [round(v, 1) for v in box.xyxy[0].tolist()]
            print(
                f"{index}. label={label} | confidence={confidence:.2f} "
                f"| bbox=({x1}, {y1}, {x2}, {y2})"
            )

    saved_image = output_dir / "yolo-detections" / image_path.name
    print("-" * 72)
    print(f"Annotated image saved to: {saved_image.resolve()}")
    print("=" * 72)


if __name__ == "__main__":
    main()
