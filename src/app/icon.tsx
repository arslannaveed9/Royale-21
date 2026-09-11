import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#f3d891",
          fontSize: 14,
          fontWeight: 700,
          borderRadius: 8,
          border: "1px solid #d4b06a",
        }}
      >
        21
      </div>
    ),
    { ...size },
  );
}
