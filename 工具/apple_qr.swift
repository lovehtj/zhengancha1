// 用 Apple 系统实现（CoreImage CIQRCodeGenerator）生成二维码并打印模块矩阵
// 用途：作为「工具/校验二维码.js」的对照基准，验证 assets/qr.js 的实现正确。
// 用法：swift apple_qr.swift "要编码的文本"
import Foundation
import CoreImage
import CoreGraphics

let args = CommandLine.arguments
guard args.count >= 2 else {
    FileHandle.standardError.write("usage: apple_qr.swift <text>\n".data(using: .utf8)!)
    exit(1)
}
let text = args[1]
guard let data = text.data(using: .utf8) else { exit(1) }

let filter = CIFilter(name: "CIQRCodeGenerator")!
filter.setValue(data, forKey: "inputMessage")
filter.setValue("M", forKey: "inputCorrectionLevel")   // 与 qr.js 一致的纠错等级
guard let out = filter.outputImage else { exit(1) }

let w = Int(out.extent.width)
let h = Int(out.extent.height)
let rect = CGRect(x: 0, y: 0, width: w, height: h)

// data: nil 让 CoreGraphics 自己分配缓冲区，随后通过 ctx.data 读取，避免指针生命周期问题
guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                          bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(),
                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { exit(1) }
ctx.interpolationQuality = .none
let ciCtx = CIContext(cgContext: ctx, options: nil)
ciCtx.draw(out, in: rect, from: rect)

guard let raw = ctx.data else { exit(1) }
let buf = raw.bindMemory(to: UInt8.self, capacity: w * h * 4)

print("\(w)x\(h)")
for y in 0..<h {
    var line = ""
    line.reserveCapacity(w)
    for x in 0..<w {
        let r = buf[(y * w + x) * 4]
        line.append(r < 128 ? "1" : "0")
    }
    print(line)
}
