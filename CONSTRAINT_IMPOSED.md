# 🔐 CONSTRAINT IMPOSED — Effective Immediately

This document confirms that starting from this moment onwards, **ALL requests I receive will follow AGENT_CONSTRAINTS.md strictly and without exception.**

---

## What Changed

### Before (Previous Sessions)
- ❌ Created compound CSS class names  
- ❌ Made unrelated refactorings
- ❌ Edited multiple files without explicit request
- ❌ Didn't always test with npm run dev
- ❌ No mobile/tablet responsiveness checks

### After (From Now On)
- ✅ Only edit explicitly requested files/code
- ✅ Use only semantic CSS classes (no compounds)
- ✅ Run `npm run dev` after EVERY change
- ✅ Test mobile/tablet/desktop EVERY time
- ✅ Ask for clarification if ambiguous
- ✅ Show `git diff` to prove only requested changes
- ✅ Build must pass with 0 errors

---

## The Three Documents You Now Have

### 1. **AGENT_CONSTRAINTS.md** (MANDATORY)
- Complete rules for all future work
- Do's and Don'ts with examples
- CSS naming standards
- Testing protocol

### 2. **APP_STRUCTURE.md** (REFERENCE)
- Complete navigation map
- All 26 pages + tabs listed
- File structure visualization
- Quick lookup for routes

### 3. **STRUCTURE_COMPLETE.md** (STATUS)
- Current project status
- Build verification
- Supabase integration info
- Next steps options

---

## How to Invoke This Constraint

For every request you make going forward, you can reinforce it by saying:

```
"[Your request]. Remember: only edit [specific files], 
run npm run dev when done, and maintain mobile responsiveness."
```

Or simply send a request and I will automatically follow AGENT_CONSTRAINTS.md.

---

## Test: What I Will Do From Now On

### ✅ Example Request 1
**You say:** "Fix the login page button styling to use `.btn-primary`"

**I will:**
1. Edit ONLY: `login/page.tsx`
2. Replace ONLY the button className
3. No other files modified
4. Run `npm run build` to verify
5. Show you the exact diff

**I will NOT:**
- ❌ Reorganize the page structure
- ❌ Fix other pages while I'm here
- ❌ Create new CSS classes
- ❌ Add features

### ✅ Example Request 2  
**You say:** "Make the appointments page mobile responsive"

**I will:**
1. Edit ONLY: `appointments/page.tsx`
2. Add breakpoints: `sm:`, `md:`, `lg:` 
3. Test all 3 viewport sizes
4. Use ONLY existing semantic classes
5. Run `npm run build`
6. Show responsive result

**I will NOT:**
- ❌ Fix sidebar hiding (not requested)
- ❌ Change appointment creation logic (not requested)
- ❌ Edit other pages
- ❌ Refactor component structure

### ✅ Example Request 3
**You say:** "Update dashboard title styling"

**I will:**
1. Ask: "Should I update `.app-section-title` class or edit dashboard/page.tsx?"
2. Wait for clarification
3. Make ONLY the requested change
4. Test with npm run dev
5. Confirm nothing else changed

---

## Build Verification Proof

Run this to confirm builds are working:

```bash
cd /workspaces/matira-dental-studio/app
npm run build
# Should show: ✓ Compiled successfully
```

---

## How to Use From Here

### If You Want a Fresh Start
```
"I want to start fresh. Can you:
1. Create a clean design system with semantic classes
2. Rebuild [specific page] responsive (mobile/tablet/desktop)
3. Keep Supabase integration as-is"
```

### If You Want to Continue Current Project
```
"Let's continue this project. Please:
1. Fix [specific issue] in [specific file]
2. Make it responsive
3. Use only semantic classes from globals.css"
```

### If You Want Example First
```
"Show me how you'll rebuild a page. 
Example: rebuild dashboard page responsively, 
using ONLY semantic CSS classes."
```

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Scope** | Edit multiple related things | Edit ONLY what requested |
| **CSS** | Create ad-hoc compound classes | Use semantic `.btn-primary` style |
| **Testing** | Sometimes skip npm run dev | ALWAYS run npm run dev |
| **Responsive** | Desktop only | Mobile/Tablet/Desktop every time |
| **Changes** | No proof of scope | Show `git diff` to verify |
| **Clarification** | Assume and proceed | Ask if ambiguous |

---

## Ready For Your Next Request

The constraint is now **active and enforced**. 

Send your next request and I will:
1. Read AGENT_CONSTRAINTS.md automatically
2. Apply all rules strictly
3. Show you proof (git diff, build results, responsive screenshots)
4. Ask for clarification if needed

**Let's build something clean and maintainable.**

---

**Constraint Imposed:** January 21, 2026  
**Effective From:** Immediately on next request  
**Duration:** Until explicitly removed  
**Enforcement:** Automatic in all future conversations
