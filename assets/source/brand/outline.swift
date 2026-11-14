import Foundation
import CoreText
import CoreGraphics
let url = URL(fileURLWithPath:"/tmp/nearfest-brand/Caprasimo-Regular.ttf")
CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
let font = CTFontCreateWithName("Caprasimo-Regular" as CFString, 100, nil)
let text = "NearFest"
let attrs = [kCTFontAttributeName as NSAttributedString.Key: font]
let line = CTLineCreateWithAttributedString(NSAttributedString(string:text,attributes:attrs))
var output:[[String:Any]]=[]
func n(_ x:CGFloat)->String { String(format:"%.3f",Double(x)) }
for run in CTLineGetGlyphRuns(line) as! [CTRun] {
 let count=CTRunGetGlyphCount(run)
 var glyphs=[CGGlyph](repeating:0,count:count), positions=[CGPoint](repeating:.zero,count:count)
 CTRunGetGlyphs(run,CFRange(location:0,length:0),&glyphs)
 CTRunGetPositions(run,CFRange(location:0,length:0),&positions)
 for i in 0..<count {
  guard let path=CTFontCreatePathForGlyph(font,glyphs[i],nil) else {continue}
  var d=""
  path.applyWithBlock { ptr in
   let e=ptr.pointee
   func p(_ i:Int)->String { return "\(n(e.points[i].x)) \(n(-e.points[i].y))" }
   switch e.type {
   case .moveToPoint:d += "M"+p(0)
   case .addLineToPoint:d += "L"+p(0)
   case .addQuadCurveToPoint:d += "Q"+p(0)+" "+p(1)
   case .addCurveToPoint:d += "C"+p(0)+" "+p(1)+" "+p(2)
   case .closeSubpath:d += "Z"
   @unknown default:break
   }
  }
  output.append(["d":d,"x":positions[i].x-CGFloat(i)*1.4,"letter":String(Array(text)[i])])
 }
}
let data=try JSONSerialization.data(withJSONObject:output,options:.prettyPrinted)
try data.write(to:URL(fileURLWithPath:"/tmp/nearfest-brand/glyphs.json"))
print(CTLineGetTypographicBounds(line,nil,nil,nil))
