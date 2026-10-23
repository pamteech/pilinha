// swift-tools-version:5.9
import PackageDescription

var targets: [Target] = [
    .target(name: "NotchInvestCore"),
    .executableTarget(name: "notch-invest-cli", dependencies: ["NotchInvestCore"]),
    .testTarget(name: "NotchInvestCoreTests", dependencies: ["NotchInvestCore"]),
]
var products: [Product] = [
    .library(name: "NotchInvestCore", targets: ["NotchInvestCore"]),
    .executable(name: "notch-invest-cli", targets: ["notch-invest-cli"]),
]
#if os(macOS)
targets.append(.executableTarget(name: "NotchInvestApp", dependencies: ["NotchInvestCore"],
                                  resources: [.copy("Resources/Cofrinho")]))
products.append(.executable(name: "NotchInvestApp", targets: ["NotchInvestApp"]))
#endif

let package = Package(
    name: "NotchInvest",
    platforms: [.macOS(.v14)],  // UnevenRoundedRectangle, onChange(of:initial:),
    products: products,
    targets: targets
)
