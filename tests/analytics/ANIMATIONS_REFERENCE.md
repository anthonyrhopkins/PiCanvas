# CSS Animation Keyframes Reference

## All Available Animations

### 1. **fadeIn**
Smooth opacity transition for element appearance.
```css
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
```
**Used for:** Section transitions, tooltip appearances  
**Duration:** Typically 0.3s  
**Easing:** ease-out  

---

### 2. **scaleIn**
Scale + opacity transition for entrance effects.
```css
@keyframes scaleIn {
    from {
        transform: scale(0.95);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}
```
**Used for:** Element entrances, modal opens  
**Duration:** Typically 0.3-0.5s  
**Easing:** ease-out  

---

### 3. **slideUp**
Element slides in from bottom with fade-in.
```css
@keyframes slideUp {
    from {
        transform: translateY(20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}
```
**Used for:** Cards, table rows, stat items  
**Duration:** Typically 0.3-0.5s  
**Easing:** ease-out  
**Staggered:** Yes (rows have cascading delays)  

---

### 4. **slideInFromRight**
Element slides in from right with fade-in.
```css
@keyframes slideInFromRight {
    from {
        transform: translateX(20px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
```
**Used for:** Toast notifications, side panels  
**Duration:** Typically 0.3s  
**Easing:** ease-out  

---

### 5. **slideInFromLeft**
Element slides in from left with fade-in.
```css
@keyframes slideInFromLeft {
    from {
        transform: translateX(-20px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
```
**Used for:** Menu items, dropdown options  
**Duration:** Typically 0.3s  
**Easing:** ease-out  

---

### 6. **slideIn** (Generic)
Element slides down with fade-in.
```css
@keyframes slideIn {
    from {
        transform: translateY(-20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}
```
**Used for:** Alerts, notifications, dropdown items  
**Duration:** Typically 0.3s  
**Easing:** ease-out  

---

### 7. **pulse**
Element pulses in opacity.
```css
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}
```
**Used for:** Loading indicators, pending states  
**Duration:** Typically 1.5-2s  
**Easing:** ease-in-out  
**Iteration:** Infinite  

---

### 8. **glow**
Element glows with box-shadow.
```css
@keyframes glow {
    0%, 100% { box-shadow: 0 0 5px rgba(0, 120, 212, 0.5); }
    50% { box-shadow: 0 0 15px rgba(0, 120, 212, 0.8); }
}
```
**Used for:** Active elements, focus states  
**Duration:** Typically 2s  
**Easing:** ease-in-out  
**Iteration:** Infinite  

---

### 9. **spin**
Element rotates continuously.
```css
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
```
**Used for:** Loading spinners, progress indicators  
**Duration:** Typically 1-2s  
**Easing:** linear  
**Iteration:** Infinite  

---

### 10. **bounce**
Element bounces up and down.
```css
@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
}
```
**Used for:** Emphasis effects, stat value highlights  
**Duration:** Typically 0.6s  
**Easing:** ease  

---

### 11. **shimmer**
Gradient overlay slides across element.
```css
@keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
}
```
**Used for:** Card hover effects, loading skeleton  
**Duration:** Typically 0.5-1s  
**Easing:** linear  
**Background:** Requires gradient setup  

---

### 12. **float**
Element floats up and down.
```css
@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
}
```
**Used for:** Hover effects, emphasis  
**Duration:** Typically 2-3s  
**Easing:** ease-in-out  
**Iteration:** Infinite  

---

### 13. **rippleAnimation**
Ripple effect expands from click point.
```css
@keyframes rippleAnimation {
    from {
        transform: scale(0);
        opacity: 1;
    }
    to {
        transform: scale(4);
        opacity: 0;
    }
}
```
**Used for:** Button click feedback  
**Duration:** Typically 0.6s  
**Easing:** ease-out  

---

## Animation Usage Guide

### When to Use Each Animation:

| Animation | Best For | Duration | Easing |
|-----------|----------|----------|--------|
| fadeIn | Appearing elements | 0.3s | ease-out |
| scaleIn | Entrance with emphasis | 0.3-0.5s | ease-out |
| slideUp | Cards, rows, items | 0.3-0.5s | ease-out |
| slideInFromRight | Toasts, notifications | 0.3s | ease-out |
| slideInFromLeft | Menu items | 0.3s | ease-out |
| pulse | Loading states | 1.5-2s | ease-in-out |
| glow | Active/focus states | 2s | ease-in-out |
| spin | Loading spinners | 1-2s | linear |
| bounce | Emphasis, highlights | 0.6s | ease |
| shimmer | Hover effects | 0.5-1s | linear |
| float | Idle animation | 2-3s | ease-in-out |
| rippleAnimation | Button clicks | 0.6s | ease-out |

---

## CSS Properties for Animation

### Transform Effects:
```css
/* Use these with animations for GPU acceleration */
transform: translateY(-4px);      /* Elevation */
transform: translateX(20px);      /* Horizontal movement */
transform: scale(1.05);           /* Scaling */
transform: rotate(360deg);        /* Rotation */
```

### Box-Shadow Effects:
```css
box-shadow: 0 4px 12px rgba(0, 120, 212, 0.3);  /* Glow */
box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.1); /* Inset depth */
```

### Opacity Effects:
```css
opacity: 0;     /* Transparent */
opacity: 0.7;   /* Semi-transparent */
opacity: 1;     /* Opaque */
```

### Border Effects:
```css
border: 2px solid var(--primary-color);     /* Colored border */
border-left: 4px solid var(--primary-color); /* Left accent */
border-bottom: 3px solid var(--primary-color); /* Bottom accent */
```

---

## Combining Animations

### Multiple Animations:
```css
.element {
    animation: slideUp 0.5s ease-out,
               glow 2s ease-in-out infinite;
}
```

### Sequential Animations:
```css
.element:hover {
    animation: bounce 0.6s ease;
}

.element:hover::before {
    animation: shimmer 0.5s linear;
}
```

### Staggered Animations:
```css
.row:nth-child(1) { animation-delay: 0s; }
.row:nth-child(2) { animation-delay: 0.05s; }
.row:nth-child(3) { animation-delay: 0.1s; }
/* etc... */
```

---

## Performance Tips

### ✅ DO:
- Use `transform` and `opacity` properties
- Use `will-change` for frequently animated elements
- Keep animation durations 0.2-1s (feel natural)
- Use `ease-out` for entrances, `ease-in-out` for loops

### ❌ DON'T:
- Animate `width`, `height`, `left`, `top` (causes reflows)
- Animate `background-color` constantly (expensive)
- Use `!important` with animations
- Create infinite animations for non-essential elements

---

## Browser Compatibility

### All Animations:
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers

### Vendor Prefixes:
```css
/* Most modern browsers don't need -webkit-, -moz-, -o- prefixes */
/* but you can add if supporting older versions */
-webkit-animation: fadeIn 0.3s ease-out;
animation: fadeIn 0.3s ease-out;
```

---

## Testing Animations

### In Chrome DevTools:
1. Right-click element → Inspect
2. In Console: `element.getAnimations()`
3. View animation timeline in Animations panel
4. Pause/replay animations
5. Adjust playback speed

### Common Commands:
```javascript
/* Get all animations on an element */
element.getAnimations()

/* Pause animation */
animation.pause()

/* Play animation */
animation.play()

/* Set playback rate */
animation.playbackRate = 0.5  /* Slow motion */
animation.playbackRate = 2    /* Fast motion */

/* Get animation progress */
animation.currentTime
animation.effect.getComputedTiming().progress
```

---

## Mobile Considerations

### Touch vs Hover:
- Hover animations: Don't break on touch devices (JavaScript handles click events)
- Mobile animations: May be slower on low-end devices
- Solution: Use `prefers-reduced-motion` media query

### Implementing Motion Preferences:
```css
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

---

## Common Animation Combinations

### Card Entrance + Hover:
```css
.card {
    animation: slideUp 0.5s ease-out;
}

.card:hover {
    animation: glow 0.3s ease-out forwards;
    transform: translateY(-4px);
}
```

### Button Click + Ripple:
```css
.button:hover {
    animation: fadeIn 0.2s ease-out;
    box-shadow: 0 4px 12px rgba(0, 120, 212, 0.4);
}

.button:active::after {
    animation: rippleAnimation 0.6s ease-out;
}
```

### Input Focus + Glow:
```css
input:focus {
    animation: scaleIn 0.2s ease-out;
    box-shadow: 0 0 0 3px rgba(0, 120, 212, 0.1);
}
```

---

## Troubleshooting

### Animation not playing:
- Check browser console for CSS errors
- Verify animation name matches @keyframes name
- Ensure duration is > 0s
- Check z-index and visibility

### Animation stuttering:
- Profile with Chrome DevTools
- Reduce number of simultaneous animations
- Use `will-change` on heavy elements
- Check for JavaScript blocking

### Animation too fast/slow:
- Adjust duration in CSS
- Check `animation-timing-function`
- Verify `animation-delay` isn't set

### Animation not smooth:
- Use `transform` instead of position properties
- Avoid expensive properties (width, height, etc.)
- Enable GPU acceleration with `transform3d`

---

**Last Updated:** December 21, 2025  
**Total Animations:** 13 different keyframes  
**Usage:** 20+ interactive elements  
