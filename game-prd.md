# 🎮 Plantgirl Super Race — Product Requirements Document (PRD)

---

## 1. Overview

**Product Name:** Plantgirl Super Race  
**Platform:** Browser (runs locally via simple HTML/JS)  
**Target Audience:** Children (~7 years old)  
**Session Length:** ~2 minutes per level  
**Build Constraint:** Implementable in ~30–60 minutes with AI assistance  
**Primary Emotion:** Exciting, fun, empowering (“I made this!”)  
**Sharing Goal:** Simple web link suitable for showing at school  

---

## 2. Product Vision

Plantgirl Super Race is a fast, colourful, kid-friendly racing game where players steer Plantgirl’s superhero car down a bold cartoony road, collecting stars and plant powerups while racing friendly AI opponents.

The experience should be:

- Easy to pick up  
- Impossible to fail  
- Visually delightful  
- Reward-rich  
- Proudly shareable  

---

## 3. Gameplay Pillars

### 🎯 Pillar 1 — Simple Joyful Driving
- Auto-forward racing
- Player focuses only on steering
- No fail state
- Smooth continuous motion

### ⭐ Pillar 2 — Reward-Rich Experience
- Frequent star pickups
- Visible prize meter
- End-of-level rewards
- Stickers applied to car
- Celebratory feedback loops

### 🌿 Pillar 3 — Plantgirl Superpower Moment
- Collectible Vine Freeze power
- Temporarily stops opponent cars
- Strong visual feedback (vines effect)
- Feels empowering and fun

---

## 4. Core Gameplay Loop

Every few seconds the player:

1. Steers car left/right  
2. Collects stars  
3. Avoids obstacles  
4. Collects plant powerups  
5. Freezes nearby opponents  
6. Progresses toward level end  
7. Receives prize selection  
8. Starts next level  

---

## 5. Game Structure

### Levels

- **Total Levels (V1):** 3  
- **Duration per Level:** ~2 minutes  
- **Track Type:** Straight auto-scrolling road  
- **Progression:** Continuous forward motion  

### Difficulty Scaling

Each level increases challenge via:

- Faster opponents  
- More obstacles  
- Slightly busier road  

---

## 6. Controls

### Keyboard
- `←` / `→` — steer left/right  
- `↑` — optional light speed boost  

### Touch / Mobile
- Swipe left/right to steer  

### Movement Model

- Car auto-accelerates forward  
- Player controls lateral movement only  
- Smooth lane-based movement (3 lanes)

---

## 7. Player Character

**Hero:** Plantgirl  
**Vehicle:** Superhero race car  
**Theme:** Superhero + plant elements  

### Special Ability — Vine Freeze

**Activation:**
- Triggered by collecting green plant powerup

**Effect:**
- Freezes nearby opponent cars  
- Duration: ~3 seconds  

**Visual Feedback:**
- Green vines wrap enemy cars  
- Subtle shake while frozen  

**Cooldown:**
- Powerup-based only (no manual button)

---

## 8. Opponent Cars

- **Count:** 3 AI opponents  
- **Behaviour:** Gentle overtaking attempts  
- **Difficulty:** Kid-friendly  

### When Frozen

- Cars stop moving  
- Play vine wrap visual  
- Resume normal behaviour after effect ends  

---

## 9. Obstacles

### Types (V1)

- Parked cars  
- Crazy plants  
- Balance beams  

### Collision Behaviour

On collision:

- Brief slowdown  
- Small bump animation  
- No health loss  
- No fail state  

**Design Goal:** Reduce frustration while keeping feedback satisfying.

---

## 10. Star & Prize System

### Star Collection

- Stars appear along the road  
- Each star:
  - Increases score  
  - Fills prize meter  

---

### End-of-Level Prize Screen

At level completion:

- Player chooses **1 of 3 prizes**

#### Prize Types (V1)

- Car stickers (primary reward)  
- Cosmetic car colours  
- Fun badge rewards  

---

### Sticker Behaviour

- Stickers visibly appear on player car  
- Persist visually during the next race  
- Bold and cartoony style  

---

## 11. Cars

### Car Selection

- **Total Cars (V1):** 4  
- Simple pre-race picker  
- No garage complexity  

### Car Differences

Light stat variation:

- Speed  
- Handling  

(Keep differences small to avoid balancing complexity.)

---

## 12. Easy Mode (Always On in V1)

To ensure a positive child experience:

- Slightly slower opponents  
- Generous lane width  
- Extended Vine Freeze duration  
- Reduced obstacle density in Level 1  

**Note:** No difficulty selector in V1.

---

## 13. Visual Style

**Art Direction:** Bold, cartoony, colourful  
**Theme Blend:** Superhero city + light plant elements  

### Environment

- Bright city road  
- Occasional plant obstacles  
- Clear lane markings  

### Camera

- Behind-the-car pseudo-3D (simplified)  

### Art Source

- AI-generated placeholders acceptable for V1  
- Canvas shapes acceptable initially  

---

## 14. Audio Requirements

### Required Sounds

- Background music (loop)  
- Star pickup sound  
- Vine Freeze power sound  
- Collision bump sound  
- Victory sound  

### Audio Goals

- Fun  
- Light  
- Not overwhelming  
- Kid-friendly  

---

## 15. End-of-Level Celebration (Critical Delight Moment)

When a level completes:

- 👍 Thumbs up emojis fall from sky  
- 😄 Smiley faces rain down  
- 🎉 Confetti burst  
- 🔊 Victory sound plays  
- 🧮 Large score display  

**This moment is mandatory for V1.**

---

## 16. Definition of Done (V1)

The game is considered shipped when:

- ✅ Runs locally in browser  
- ✅ Player can steer car  
- ✅ Stars are collectible  
- ✅ Vine Freeze works  
- ✅ 3 playable levels exist  
- ✅ Prize selection works  
- ✅ Stickers appear on car  
- ✅ End celebration triggers  
- ✅ Game can be shared via link  

---

## 17. Technical Approach

### Technology Stack

- HTML  
- CSS  
- Canvas API  

### Architecture Principles

- Single-page game  
- No backend  
- No accounts  
- No persistence required  
- Clean modular JS  
- Easy to extend later  

---

## 18. Explicit Non-Goals (V1 Scope Protection)

The following are **out of scope for V1**:

- Multiplayer  
- User accounts  
- Cloud saves  
- Complex menus  
- Monetisation  
- Advanced physics  
- Full 3D rendering  

---

## 19. Success Criteria

V1 is successful if:

- A 7-year-old can play immediately  
- The game feels exciting within 10 seconds  
- The end celebration creates visible delight  
- The child feels proud to share it  
- The codebase is easy to extend in future sessions  

---

**End of PRD**
