# Device Model Details Panel - Visual Reference Guide

## Component Layout Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CARD HEADER                          │
│  [Device Icon] Device Model Name            [Details]   │
│  Comprehensive device specifications and information     │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│                   CARD CONTENT                          │
│                                                         │
│              ┌──────────────────────┐                  │
│              │                      │                  │
│              │  DEVICE IMAGE        │ ← Prominent     │
│              │    Large Square      │   Image Display │
│              │  [Device Name Badge] │   with Gradient │
│              │                      │   Border        │
│              └──────────────────────┘                  │
│                                                         │
│     ┌─────────────────┬──────────────────────┐         │
│     │ Device Type 📱  │ Release Date 📅      │         │
│     │ Smartphone      │ 2023-09-22           │         │
│     ├─────────────────┼──────────────────────┤         │
│     │ Price 💰        │ Colors 🎨            │         │
│     │ $999            │ Black, Silver, Gold  │         │
│     └─────────────────┴──────────────────────┘         │
│                                                         │
│     COMPLETE SPECIFICATIONS                            │
│     ═════════════════════════════════════════════      │
│                                                         │
│  [Display] [Platform] [Camera] [Connect] [Features]    │
│                                                         │
│  ═════════════════════════════════════════════        │
│  📺 DISPLAY SPECIFICATIONS                             │
│  ═════════════════════════════════════════════        │
│  Type ...................... AMOLED                    │
│  Size ...................... 6.1 inches                │
│  Resolution ................ 1170 x 2532 pixels       │
│  Protection ................ Ceramic Shield            │
│  Features .................. 120Hz refresh rate        │
│                                                         │
│  ═════════════════════════════════════════════        │
│  📦 PHYSICAL PROPERTIES                                │
│  ═════════════════════════════════════════════        │
│  Dimensions ................ 147.5 x 71.6 x 8.7 mm    │
│  Weight .................... 185 grams                 │
│  Build ..................... Titanium frame            │
│  SIM Type .................. Nano-SIM                  │
│  SIM Count ................. Dual SIM                  │
│                                                         │
│     ... (more tabs) ...                                │
│                                                         │
│     ┌──────────┬──────────┬──────────┬──────────┐     │
│     │ Image 1  │ Image 2  │ Image 3  │ Image 4  │     │
│     │ #1       │ #2       │ #3       │ #4       │     │
│     │[Device]  │[Device]  │[Device]  │[Device]  │     │
│     │ View     │ View     │ View     │ View     │     │
│     │ Caption  │ Caption  │ Caption  │ Caption  │     │
│     └──────────┴──────────┴──────────┴──────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Color Scheme Reference

### Specification Section Colors

```
┌─────────────────────────────────────────────────────────┐
│ Section           │ Color    │ Icon │ Use Case         │
├─────────────────────────────────────────────────────────┤
│ Display           │ Purple   │ 📺   │ Screen specs     │
│ Physical Props    │ Yellow   │ 📦   │ Physical details │
│ Platform & Perf   │ Green    │ ⚙️   │ Processor/OS     │
│ Memory & Storage  │ Blue     │ ⚡   │ RAM/Storage      │
│ Battery           │ Red      │ 🔋   │ Power info       │
│ Rear Camera       │ Indigo   │ 📷   │ Back cameras     │
│ Front Camera      │ Pink     │ 📷   │ Selfie camera    │
│ Network           │ Teal     │ 📡   │ Mobile networks  │
│ Connectivity      │ Sky      │ 📡   │ WiFi/Bluetooth   │
│ Features          │ Violet   │ ✓    │ Special features │
│ Audio             │ Lime     │ 🔊   │ Sound system     │
│ Other Info        │ Amber    │ ℹ️   │ Additional data  │
└─────────────────────────────────────────────────────────┘
```

## Responsive Breakpoints

### Mobile Layout (375px)
```
┌──────────────────────────┐
│    [Device Image]        │  ← Full width
│    [Device Name Badge]   │
├──────────────────────────┤
│ Device Type              │
│ Smartphone               │
├──────────────────────────┤
│ Release Date             │
│ 2023-09-22               │
├──────────────────────────┤
│ Price | Colors           │  ← Stacked
├──────────────────────────┤
│ Display Platform Camera  │  ← Icon tabs only
│  📺      ⚙️      📷
├──────────────────────────┤
│ 📺 Display Specs         │
│ Type: AMOLED             │
│ Size: 6.1 inches         │
├──────────────────────────┤
│ [Image] [Image]          │  ← 2 columns
│  #1      #2
│ [Image] [Image]          │
│  #3      #4
└──────────────────────────┘
```

### Tablet Layout (768px)
```
┌────────────────────────────────────────┐
│      [Device Image]                    │
│      [Device Name Badge]               │
├───────────────────┬────────────────────┤
│ Device Type       │ Release Date       │
│ Smartphone        │ 2023-09-22         │
├───────────────────┼────────────────────┤
│ Price             │ Colors             │
│ $999              │ Black, Silver, Gold│
├────────────────────────────────────────┤
│ Display Platform Camera Connectivity   │
│  📺     ⚙️        📷        📡
├────────────────────────────────────────┤
│ 📺 Display Specs                       │
│ Type: AMOLED    Size: 6.1 inches      │
├────────────────────────────────────────┤
│ [Image] [Image]  [Image]              │  ← 3 columns
│  #1      #2       #3
│ [Image] [Image]  [Image]              │
│  #4      #5       #6
└────────────────────────────────────────┘
```

### Desktop Layout (1920px)
```
┌────────────────────────────────────────────────────────────────────┐
│           [Device Image]                                           │
│           [Device Name Badge]                                      │
├───────────────────┬──────────────────┬──────────────┬─────────────┤
│ Device Type       │ Release Date     │ Price        │ Colors      │
│ Smartphone        │ 2023-09-22       │ $999         │ Black, etc  │
├────────────────────────────────────────────────────────────────────┤
│ Display Platform Camera Connectivity Features                      │
│  📺      ⚙️       📷     📡         (Desktop)
├────────────────────────────────────────────────────────────────────┤
│ 📺 Display                      📦 Physical Properties             │
│ Type: AMOLED                    Dimensions: 147.5 x 71.6 x 8.7    │
│ Size: 6.1 inches                Weight: 185 grams                 │
├────────────────────────────────────────────────────────────────────┤
│ [Image] [Image] [Image] [Image]                                   │  ← 4 columns
│  #1      #2      #3      #4
│ [Image] [Image] [Image] [Image]                                   │
│  #5      #6      #7      #8
└────────────────────────────────────────────────────────────────────┘
```

## Detailed Section Examples

### Basic Information Cards

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌──────────────┬──────────────┬──────────────────┐    │
│  │ 📱 Device    │ 📅 Release   │ 💰 Price         │    │
│  │ Type         │ Date         │                  │    │
│  │ ────────────  │ ─────────────│ ──────────────── │    │
│  │ Smartphone   │ 2023-09-22   │ $999             │    │
│  └──────────────┴──────────────┴──────────────────┘    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🎨 Available Colors                            │  │
│  │ ────────────────────────────────────────────────│  │
│  │ [Black] [Silver] [Gold] [Midnight] [Pro Max]   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Specification Tab Content

```
╔════════════════════════════════════════════════════════╗
║  📺 DISPLAY SPECIFICATIONS                             ║
╚════════════════════════════════════════════════════════╝
Type ......................... AMOLED
Size ......................... 6.1 inches
Resolution ................... 1170 x 2532 pixels
Protection ................... Ceramic Shield
Features ..................... 120Hz refresh rate

╔════════════════════════════════════════════════════════╗
║  📦 PHYSICAL PROPERTIES                                ║
╚════════════════════════════════════════════════════════╝
Dimensions ................... 147.5 x 71.6 x 8.7 mm
Weight ....................... 185 grams
Build ........................ Titanium frame
SIM Type ..................... Nano-SIM
SIM Count .................... Dual SIM
```

### Feature Highlights

```
╔════════════════════════════════════════════════════════╗
║  ✓ FEATURES & ADDITIONAL INFO                          ║
╚════════════════════════════════════════════════════════╝

Sensors:
Accelerometer, Gyroscope, Proximity Sensor, Ambient Light
Sensor, Barometer, Compass

Special Features:
[Face ID] [Super Retina XDR] [Always-On Display]
[ProMotion 120Hz] [Dynamic Island] [Titanium Design]

╔════════════════════════════════════════════════════════╗
║  🔊 AUDIO                                              ║
╚════════════════════════════════════════════════════════╝
Loudspeaker .................. Stereo speakers
3.5mm Jack ................... Not present

╔════════════════════════════════════════════════════════╗
║  ℹ️ OTHER INFORMATION                                  ║
╚════════════════════════════════════════════════════════╝
Model Numbers:
[A2846] [A2847] [A2848] [A2849]

SAR Values (W/kg):
Head: 0.97
Body: 0.98
```

## Tab Navigation Visual

```
╔═══════════════════════════════════════════════════════╗
║ Tab List (Light Mode)                                 ║
├─────────────┬───────────┬──────────┬────────┬────────┤
│ Display     │ Platform  │ Camera   │ Connect│ Features
│    (active) │           │          │        │
└─────────────┴───────────┴──────────┴────────┴────────┘

╔═══════════════════════════════════════════════════════╗
║ Tab List (Dark Mode)                                  ║
├─────────────┬───────────┬──────────┬────────┬────────┤
│ Display     │ Platform  │ Camera   │ Connect│ Features
│    (active) │           │          │        │
└─────────────┴───────────┴──────────┴────────┴────────┘

╔═══════════════════════════════════════════════════════╗
║ Tab List (Mobile)                                     ║
├──────┬──────┬──────┬──────┬───────┤
│ 📺   │ ⚙️   │ 📷   │ 📡   │ (swipe)
├──────┴──────┴──────┴──────┴───────┤
│ Selected Tab Content Display       │
└───────────────────────────────────┘
```

## Image Gallery Layout

### Desktop (4 columns)
```
┌────────────────────────────────────────────────────────┐
│ 📸 Device Image Gallery                    4 Images    │
├────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ #1       │ │ #2       │ │ #3       │ │ #4       │  │
│ │          │ │          │ │          │ │          │  │
│ │ [Image]  │ │ [Image]  │ │ [Image]  │ │ [Image]  │  │
│ │          │ │          │ │          │ │          │  │
│ │ Front    │ │ Back     │ │ Side     │ │ Bottom   │  │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└────────────────────────────────────────────────────────┘
```

### Tablet (3 columns)
```
┌─────────────────────────────────────────┐
│ 📸 Device Image Gallery      3 Images    │
├─────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ #1       │ │ #2       │ │ #3       │ │
│ │ [Image]  │ │ [Image]  │ │ [Image]  │ │
│ │ Front    │ │ Back     │ │ Side     │ │
│ └──────────┘ └──────────┘ └──────────┘ │
│ ┌──────────┐                           │
│ │ #4       │                           │
│ │ [Image]  │                           │
│ │ Bottom   │                           │
│ └──────────┘                           │
└─────────────────────────────────────────┘
```

### Mobile (2 columns)
```
┌──────────────────────┐
│ 📸 Device Gallery    │
│ 4 Images             │
├──────────────────────┤
│ ┌────────┐ ┌────────┐
│ │ #1     │ │ #2     │
│ │[Image] │ │[Image] │
│ │ Front  │ │ Back   │
│ └────────┘ └────────┘
│ ┌────────┐ ┌────────┐
│ │ #3     │ │ #4     │
│ │[Image] │ │[Image] │
│ │ Side   │ │ Bottom │
│ └────────┘ └────────┘
└──────────────────────┘
```

## Dark Mode Comparison

### Light Mode
```
Background: White (#FFFFFF)
Text: Dark Gray (#1F2937)
Borders: Light Gray (#E5E7EB)
Gradients: Light pastel colors
Shadows: Subtle gray
```

### Dark Mode
```
Background: Dark Gray (#111827)
Text: Light Gray (#F3F4F6)
Borders: Medium Gray (#374151)
Gradients: Darker pastel colors with reduced opacity
Shadows: Subtle with transparency
```

## Hover Effects

### Image Hover
```
Before Hover:          After Hover:
┌────────────┐        ┌────────────┐
│            │        │            │
│  [Image]   │        │  [Image]   │  ← Scales to 110%
│            │        │            │
└────────────┘        └────────────┘
scale: 100%           scale: 110%
```

### Card Hover
```
Before Hover:          After Hover:
┌────────────┐        ┌────────────┐
│ Spec Card  │        │ Spec Card  │  ← Shadow increases
│            │        │            │
└────────────┘        └────────────┘
box-shadow: md         box-shadow: lg
```

## Animation Sequence

### Page Load
1. Fade-in device image (500ms)
2. Slide-in basic information cards
3. Tab content appears
4. Image gallery fades in

### Tab Switch
1. Current tab content fades out (200ms)
2. New tab content fades in (300ms)
3. Content repositions smoothly

### Hover
1. Image/Card shadow increases (200ms)
2. Image scales (300ms duration)
3. Smooth easing with transition

---

## Design System Summary

| Element | Property | Value |
|---------|----------|-------|
| Card Border | Width | 2px |
| Section Border | Width | 2px |
| Image Border | Width | 4px |
| Radius (Cards) | Value | rounded-xl |
| Radius (Images) | Value | rounded-2xl |
| Font (Title) | Size | text-base |
| Font (Label) | Size | text-sm |
| Font (Value) | Size | text-sm |
| Shadow (Cards) | Value | shadow-md |
| Shadow (Gallery) | Value | shadow-md hover:shadow-lg |
| Spacing (Vertical) | Value | space-y-6 |
| Spacing (Horizontal) | Value | gap-4 |

---

This visual reference guide helps developers and designers understand the component layout, colors, responsive behavior, and styling at a glance.
