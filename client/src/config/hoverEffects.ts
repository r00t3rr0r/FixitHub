// Hover.css Effects Configuration
// A curated collection of CSS3 powered hover effects

export interface HoverEffect {
  name: string;
  className: string;
  category: 'attention' | '2d-transitions' | 'background' | 'border' | 'shadow' | 'speech-bubbles' | 'curls' | 'icons';
  description: string;
  preview: string;
  applicableTo: ('button' | 'image' | 'icon' | 'card' | 'link' | 'text' | 'all')[];
}

export const HOVER_EFFECTS: HoverEffect[] = [
  // None option
  {
    name: 'None',
    className: '',
    category: '2d-transitions',
    description: 'No hover effect',
    preview: 'Default state',
    applicableTo: ['all']
  },

  // 2D Transitions
  {
    name: 'Grow',
    className: 'hvr-grow',
    category: '2d-transitions',
    description: 'Grows the element on hover',
    preview: 'Scale up smoothly',
    applicableTo: ['button', 'image', 'icon', 'card', 'all']
  },
  {
    name: 'Shrink',
    className: 'hvr-shrink',
    category: '2d-transitions',
    description: 'Shrinks the element on hover',
    preview: 'Scale down smoothly',
    applicableTo: ['button', 'image', 'icon', 'card', 'all']
  },
  {
    name: 'Pulse',
    className: 'hvr-pulse',
    category: '2d-transitions',
    description: 'Pulses the element continuously',
    preview: 'Rhythmic pulsing effect',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Pulse Grow',
    className: 'hvr-pulse-grow',
    category: '2d-transitions',
    description: 'Pulses with growing effect',
    preview: 'Grows while pulsing',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Pulse Shrink',
    className: 'hvr-pulse-shrink',
    category: '2d-transitions',
    description: 'Pulses with shrinking effect',
    preview: 'Shrinks while pulsing',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Push',
    className: 'hvr-push',
    category: '2d-transitions',
    description: 'Pushes the element down',
    preview: 'Push down effect',
    applicableTo: ['button', 'all']
  },
  {
    name: 'Pop',
    className: 'hvr-pop',
    category: '2d-transitions',
    description: 'Pops the element forward',
    preview: 'Pop forward effect',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Bounce In',
    className: 'hvr-bounce-in',
    category: '2d-transitions',
    description: 'Bounces in on hover',
    preview: 'Bounce inward',
    applicableTo: ['button', 'all']
  },
  {
    name: 'Bounce Out',
    className: 'hvr-bounce-out',
    category: '2d-transitions',
    description: 'Bounces out on hover',
    preview: 'Bounce outward',
    applicableTo: ['button', 'all']
  },
  {
    name: 'Rotate',
    className: 'hvr-rotate',
    category: '2d-transitions',
    description: 'Rotates clockwise',
    preview: 'Rotate 360°',
    applicableTo: ['button', 'icon', 'image', 'all']
  },
  {
    name: 'Grow Rotate',
    className: 'hvr-grow-rotate',
    category: '2d-transitions',
    description: 'Grows and rotates',
    preview: 'Grow while rotating',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Float',
    className: 'hvr-float',
    category: '2d-transitions',
    description: 'Floats upward',
    preview: 'Float up smoothly',
    applicableTo: ['button', 'card', 'image', 'all']
  },
  {
    name: 'Sink',
    className: 'hvr-sink',
    category: '2d-transitions',
    description: 'Sinks downward',
    preview: 'Sink down smoothly',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Bob',
    className: 'hvr-bob',
    category: '2d-transitions',
    description: 'Bobs up and down',
    preview: 'Continuous bobbing',
    applicableTo: ['icon', 'image', 'all']
  },
  {
    name: 'Hang',
    className: 'hvr-hang',
    category: '2d-transitions',
    description: 'Hangs and swings',
    preview: 'Swinging motion',
    applicableTo: ['icon', 'image', 'all']
  },
  {
    name: 'Skew',
    className: 'hvr-skew',
    category: '2d-transitions',
    description: 'Skews the element',
    preview: 'Skew transform',
    applicableTo: ['button', 'all']
  },
  {
    name: 'Skew Forward',
    className: 'hvr-skew-forward',
    category: '2d-transitions',
    description: 'Skews forward',
    preview: 'Skew to the right',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Skew Backward',
    className: 'hvr-skew-backward',
    category: '2d-transitions',
    description: 'Skews backward',
    preview: 'Skew to the left',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Wobble Horizontal',
    className: 'hvr-wobble-horizontal',
    category: '2d-transitions',
    description: 'Wobbles horizontally',
    preview: 'Horizontal wobble',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Wobble Vertical',
    className: 'hvr-wobble-vertical',
    category: '2d-transitions',
    description: 'Wobbles vertically',
    preview: 'Vertical wobble',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Wobble To Bottom Right',
    className: 'hvr-wobble-to-bottom-right',
    category: '2d-transitions',
    description: 'Wobbles to bottom right',
    preview: 'Wobble diagonal',
    applicableTo: ['button', 'all']
  },
  {
    name: 'Wobble To Top Right',
    className: 'hvr-wobble-to-top-right',
    category: '2d-transitions',
    description: 'Wobbles to top right',
    preview: 'Wobble diagonal up',
    applicableTo: ['button', 'all']
  },
  {
    name: 'Wobble Top',
    className: 'hvr-wobble-top',
    category: '2d-transitions',
    description: 'Wobbles at the top',
    preview: 'Top wobble',
    applicableTo: ['button', 'all']
  },
  {
    name: 'Wobble Bottom',
    className: 'hvr-wobble-bottom',
    category: '2d-transitions',
    description: 'Wobbles at the bottom',
    preview: 'Bottom wobble',
    applicableTo: ['button', 'all']
  },
  {
    name: 'Wobble Skew',
    className: 'hvr-wobble-skew',
    category: '2d-transitions',
    description: 'Wobbles with skew',
    preview: 'Wobble and skew',
    applicableTo: ['button', 'all']
  },
  {
    name: 'Buzz',
    className: 'hvr-buzz',
    category: '2d-transitions',
    description: 'Buzzes rapidly',
    preview: 'Rapid vibration',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Buzz Out',
    className: 'hvr-buzz-out',
    category: '2d-transitions',
    description: 'Buzzes outward',
    preview: 'Buzz outward',
    applicableTo: ['button', 'icon', 'all']
  },

  // Border Transitions
  {
    name: 'Border Fade',
    className: 'hvr-border-fade',
    category: 'border',
    description: 'Fades in a border',
    preview: 'Border fade in',
    applicableTo: ['button', 'card', 'image', 'all']
  },
  {
    name: 'Hollow',
    className: 'hvr-hollow',
    category: 'border',
    description: 'Hollow border effect',
    preview: 'Hollows out',
    applicableTo: ['button', 'all']
  },
  {
    name: 'Trim',
    className: 'hvr-trim',
    category: 'border',
    description: 'Trim border animation',
    preview: 'Border trim',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Ripple Out',
    className: 'hvr-ripple-out',
    category: 'border',
    description: 'Ripple effect outward',
    preview: 'Ripple expanding',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Ripple In',
    className: 'hvr-ripple-in',
    category: 'border',
    description: 'Ripple effect inward',
    preview: 'Ripple contracting',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Outline Out',
    className: 'hvr-outline-out',
    category: 'border',
    description: 'Outline expands out',
    preview: 'Outline expands',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Outline In',
    className: 'hvr-outline-in',
    category: 'border',
    description: 'Outline contracts in',
    preview: 'Outline contracts',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Round Corners',
    className: 'hvr-round-corners',
    category: 'border',
    description: 'Rounds corners on hover',
    preview: 'Corners round',
    applicableTo: ['button', 'card', 'image', 'all']
  },
  {
    name: 'Underline From Left',
    className: 'hvr-underline-from-left',
    category: 'border',
    description: 'Underline slides from left',
    preview: 'Underline left to right',
    applicableTo: ['link', 'text', 'button', 'all']
  },
  {
    name: 'Underline From Center',
    className: 'hvr-underline-from-center',
    category: 'border',
    description: 'Underline expands from center',
    preview: 'Underline from center',
    applicableTo: ['link', 'text', 'button', 'all']
  },
  {
    name: 'Underline From Right',
    className: 'hvr-underline-from-right',
    category: 'border',
    description: 'Underline slides from right',
    preview: 'Underline right to left',
    applicableTo: ['link', 'text', 'button', 'all']
  },
  {
    name: 'Overline From Left',
    className: 'hvr-overline-from-left',
    category: 'border',
    description: 'Overline slides from left',
    preview: 'Overline left to right',
    applicableTo: ['link', 'text', 'button', 'all']
  },
  {
    name: 'Overline From Center',
    className: 'hvr-overline-from-center',
    category: 'border',
    description: 'Overline expands from center',
    preview: 'Overline from center',
    applicableTo: ['link', 'text', 'button', 'all']
  },
  {
    name: 'Overline From Right',
    className: 'hvr-overline-from-right',
    category: 'border',
    description: 'Overline slides from right',
    preview: 'Overline right to left',
    applicableTo: ['link', 'text', 'button', 'all']
  },

  // Shadow and Glow Transitions
  {
    name: 'Shadow',
    className: 'hvr-shadow',
    category: 'shadow',
    description: 'Adds shadow on hover',
    preview: 'Shadow appears',
    applicableTo: ['button', 'card', 'image', 'all']
  },
  {
    name: 'Grow Shadow',
    className: 'hvr-grow-shadow',
    category: 'shadow',
    description: 'Grows with shadow',
    preview: 'Grow with shadow',
    applicableTo: ['button', 'card', 'image', 'all']
  },
  {
    name: 'Box Shadow Outset',
    className: 'hvr-box-shadow-outset',
    category: 'shadow',
    description: 'Box shadow outset effect',
    preview: 'Outset shadow',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Box Shadow Inset',
    className: 'hvr-box-shadow-inset',
    category: 'shadow',
    description: 'Box shadow inset effect',
    preview: 'Inset shadow',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Float Shadow',
    className: 'hvr-float-shadow',
    category: 'shadow',
    description: 'Floats with shadow',
    preview: 'Float up with shadow',
    applicableTo: ['button', 'card', 'image', 'all']
  },
  {
    name: 'Glow',
    className: 'hvr-glow',
    category: 'shadow',
    description: 'Glowing effect',
    preview: 'Glow appearance',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Shadow Radial',
    className: 'hvr-shadow-radial',
    category: 'shadow',
    description: 'Radial shadow effect',
    preview: 'Radial shadow',
    applicableTo: ['button', 'card', 'all']
  },

  // Background Transitions
  {
    name: 'Fade',
    className: 'hvr-fade',
    category: 'background',
    description: 'Fades background color',
    preview: 'Background fade',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Back Pulse',
    className: 'hvr-back-pulse',
    category: 'background',
    description: 'Background pulses',
    preview: 'Background pulse',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Sweep To Right',
    className: 'hvr-sweep-to-right',
    category: 'background',
    description: 'Background sweeps right',
    preview: 'Sweep left to right',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Sweep To Left',
    className: 'hvr-sweep-to-left',
    category: 'background',
    description: 'Background sweeps left',
    preview: 'Sweep right to left',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Sweep To Bottom',
    className: 'hvr-sweep-to-bottom',
    category: 'background',
    description: 'Background sweeps bottom',
    preview: 'Sweep top to bottom',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Sweep To Top',
    className: 'hvr-sweep-to-top',
    category: 'background',
    description: 'Background sweeps top',
    preview: 'Sweep bottom to top',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Bounce To Right',
    className: 'hvr-bounce-to-right',
    category: 'background',
    description: 'Background bounces right',
    preview: 'Bounce to right',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Bounce To Left',
    className: 'hvr-bounce-to-left',
    category: 'background',
    description: 'Background bounces left',
    preview: 'Bounce to left',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Bounce To Bottom',
    className: 'hvr-bounce-to-bottom',
    category: 'background',
    description: 'Background bounces bottom',
    preview: 'Bounce to bottom',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Bounce To Top',
    className: 'hvr-bounce-to-top',
    category: 'background',
    description: 'Background bounces top',
    preview: 'Bounce to top',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Radial Out',
    className: 'hvr-radial-out',
    category: 'background',
    description: 'Radial background out',
    preview: 'Radial expand',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Radial In',
    className: 'hvr-radial-in',
    category: 'background',
    description: 'Radial background in',
    preview: 'Radial contract',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Rectangle In',
    className: 'hvr-rectangle-in',
    category: 'background',
    description: 'Rectangle effect inward',
    preview: 'Rectangle in',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Rectangle Out',
    className: 'hvr-rectangle-out',
    category: 'background',
    description: 'Rectangle effect outward',
    preview: 'Rectangle out',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Shutter In Horizontal',
    className: 'hvr-shutter-in-horizontal',
    category: 'background',
    description: 'Horizontal shutter in',
    preview: 'Shutter horizontal',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Shutter Out Horizontal',
    className: 'hvr-shutter-out-horizontal',
    category: 'background',
    description: 'Horizontal shutter out',
    preview: 'Shutter out horizontal',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Shutter In Vertical',
    className: 'hvr-shutter-in-vertical',
    category: 'background',
    description: 'Vertical shutter in',
    preview: 'Shutter vertical',
    applicableTo: ['button', 'card', 'all']
  },
  {
    name: 'Shutter Out Vertical',
    className: 'hvr-shutter-out-vertical',
    category: 'background',
    description: 'Vertical shutter out',
    preview: 'Shutter out vertical',
    applicableTo: ['button', 'card', 'all']
  },

  // Icon Transitions
  {
    name: 'Icon Back',
    className: 'hvr-icon-back',
    category: 'icons',
    description: 'Icon moves backward',
    preview: 'Icon moves back',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Icon Forward',
    className: 'hvr-icon-forward',
    category: 'icons',
    description: 'Icon moves forward',
    preview: 'Icon moves forward',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Icon Down',
    className: 'hvr-icon-down',
    category: 'icons',
    description: 'Icon moves down',
    preview: 'Icon drops down',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Icon Up',
    className: 'hvr-icon-up',
    category: 'icons',
    description: 'Icon moves up',
    preview: 'Icon moves up',
    applicableTo: ['button', 'icon', 'all']
  },
  {
    name: 'Icon Spin',
    className: 'hvr-icon-spin',
    category: 'icons',
    description: 'Icon spins',
    preview: 'Icon rotates',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Drop',
    className: 'hvr-icon-drop',
    category: 'icons',
    description: 'Icon drops',
    preview: 'Icon falls',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Fade',
    className: 'hvr-icon-fade',
    category: 'icons',
    description: 'Icon fades',
    preview: 'Icon fade in/out',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Float Away',
    className: 'hvr-icon-float-away',
    category: 'icons',
    description: 'Icon floats away',
    preview: 'Icon floats up',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Sink Away',
    className: 'hvr-icon-sink-away',
    category: 'icons',
    description: 'Icon sinks away',
    preview: 'Icon sinks down',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Grow',
    className: 'hvr-icon-grow',
    category: 'icons',
    description: 'Icon grows',
    preview: 'Icon scales up',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Shrink',
    className: 'hvr-icon-shrink',
    category: 'icons',
    description: 'Icon shrinks',
    preview: 'Icon scales down',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Pulse',
    className: 'hvr-icon-pulse',
    category: 'icons',
    description: 'Icon pulses',
    preview: 'Icon pulsing',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Pulse Grow',
    className: 'hvr-icon-pulse-grow',
    category: 'icons',
    description: 'Icon pulses and grows',
    preview: 'Icon pulse grow',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Pulse Shrink',
    className: 'hvr-icon-pulse-shrink',
    category: 'icons',
    description: 'Icon pulses and shrinks',
    preview: 'Icon pulse shrink',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Push',
    className: 'hvr-icon-push',
    category: 'icons',
    description: 'Icon pushes',
    preview: 'Icon push effect',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Pop',
    className: 'hvr-icon-pop',
    category: 'icons',
    description: 'Icon pops',
    preview: 'Icon pop effect',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Bounce',
    className: 'hvr-icon-bounce',
    category: 'icons',
    description: 'Icon bounces',
    preview: 'Icon bounce',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Rotate',
    className: 'hvr-icon-rotate',
    category: 'icons',
    description: 'Icon rotates',
    preview: 'Icon rotation',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Grow Rotate',
    className: 'hvr-icon-grow-rotate',
    category: 'icons',
    description: 'Icon grows and rotates',
    preview: 'Icon grow rotate',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Float',
    className: 'hvr-icon-float',
    category: 'icons',
    description: 'Icon floats',
    preview: 'Icon floating',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Sink',
    className: 'hvr-icon-sink',
    category: 'icons',
    description: 'Icon sinks',
    preview: 'Icon sinking',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Bob',
    className: 'hvr-icon-bob',
    category: 'icons',
    description: 'Icon bobs',
    preview: 'Icon bobbing',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Hang',
    className: 'hvr-icon-hang',
    category: 'icons',
    description: 'Icon hangs',
    preview: 'Icon hanging',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Buzz',
    className: 'hvr-icon-buzz',
    category: 'icons',
    description: 'Icon buzzes',
    preview: 'Icon buzzing',
    applicableTo: ['icon', 'all']
  },
  {
    name: 'Icon Buzz Out',
    className: 'hvr-icon-buzz-out',
    category: 'icons',
    description: 'Icon buzzes outward',
    preview: 'Icon buzz out',
    applicableTo: ['icon', 'all']
  }
];

// Helper function to get effects by category
export const getEffectsByCategory = (category: HoverEffect['category']): HoverEffect[] => {
  return HOVER_EFFECTS.filter(effect => effect.category === category);
};

// Helper function to get effects applicable to a component type
export const getApplicableEffects = (componentType: string): HoverEffect[] => {
  return HOVER_EFFECTS.filter(effect =>
    effect.applicableTo.includes('all') || effect.applicableTo.includes(componentType as any)
  );
};

// Helper function to get all categories
export const getCategories = (): string[] => {
  return Array.from(new Set(HOVER_EFFECTS.map(effect => effect.category)));
};

// Helper function to get effect by className
export const getEffectByClassName = (className: string): HoverEffect | undefined => {
  return HOVER_EFFECTS.find(effect => effect.className === className);
};
