import { describe, expect, it } from "vitest"
import { cropTransform, getCroppedImage, rotatedBounds } from "./-crop-image"

const close = (actual: number, expected: number) =>
  expect(actual).toBeCloseTo(expected, 5)

describe("rotatedBounds", () => {
  it("keeps the image size at 0 and 180 degrees", () => {
    expect(rotatedBounds(400, 300, 0)).toEqual({ width: 400, height: 300 })
    close(rotatedBounds(400, 300, 180).width, 400)
    close(rotatedBounds(400, 300, 180).height, 300)
  })

  it("swaps the axes at 90 degrees", () => {
    close(rotatedBounds(400, 300, 90).width, 300)
    close(rotatedBounds(400, 300, 90).height, 400)
    close(rotatedBounds(400, 300, 270).width, 300)
    close(rotatedBounds(400, 300, 270).height, 400)
  })

  it("grows a square by sqrt(2) when turned 45 degrees", () => {
    close(rotatedBounds(100, 100, 45).width, 141.421356)
    close(rotatedBounds(100, 100, 45).height, 141.421356)
  })
})

describe("cropTransform", () => {
  it("maps the image centre to the canvas centre for a full square crop", () => {
    const t = cropTransform(
      100,
      100,
      { x: 0, y: 0, width: 100, height: 100 },
      0,
    )
    close(t.scaleX, 5.12)
    close(t.scaleY, 5.12)
    close(t.centerX, 256)
    close(t.centerY, 256)
  })

  it("offsets the image when the crop is not centred", () => {
    // Top-left quarter of a 100x100 image: the image centre sits on the
    // bottom-right corner of the output.
    const t = cropTransform(100, 100, { x: 25, y: 0, width: 50, height: 50 }, 0)
    close(t.scaleX, 10.24)
    close(t.scaleY, 10.24)
    close(t.centerX, 256)
    close(t.centerY, 512)
  })

  it("uses the rotated bounding box after a 90 degree turn", () => {
    // 100x50 turned 90 degrees occupies a 50x100 box; a centred 50x50 crop
    // gets the whole box width, so the scale doubles.
    const t = cropTransform(100, 50, { x: 0, y: 25, width: 50, height: 50 }, 90)
    close(t.scaleX, 10.24)
    close(t.scaleY, 10.24)
    close(t.centerX, 256)
    close(t.centerY, 256)
  })

  it("keeps the output square when the reported crop is one pixel off", () => {
    const t = cropTransform(
      800,
      600,
      { x: 0, y: 0, width: 301, height: 300 },
      0,
    )
    close(t.scaleX * 301, 512)
    close(t.scaleY * 300, 512)
  })
})

describe("getCroppedImage", () => {
  it("rejects an empty crop before touching the DOM", async () => {
    await expect(
      getCroppedImage("blob:unused", { x: 0, y: 0, width: 0, height: 0 }, 0),
    ).rejects.toThrow("Crop area is empty")
  })
})
