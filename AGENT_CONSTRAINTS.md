# 🔴 AGENT CONSTRAINTS — MANDATORY FOR ALL REQUESTS

## Core Rule
**ONLY edit files/components explicitly requested. NOTHING ELSE.**

---

## ✅ WHAT YOU MUST DO

### For Every Single Request:
1. **Identify exact files to change** - Ask if ambiguous
2. **Make surgical, targeted changes** - Only the lines requested
3. **No refactoring, reorganizing, or "while I'm here" improvements**
4. **Test with `npm run dev` EVERY TIME** - Fix build errors along the way
5. **Show only changed files** - `git diff` should reflect ONLY requested changes
6. **Ask first if unclear** - Don't assume or expand scope

### Example ✅ CORRECT
```
Request: "Fix the save button styling in patients info page"
Action: Edit ONLY the `.btn-primary-standard` class in info/page.tsx button
Result: One file changed, one class updated, tested with npm run dev
```

---

## ❌ WHAT YOU MUST NOT DO

1. **Refactor unrelated code** ❌
   ```
   Request: "Change patients page button color"
   Wrong: Also reorganizing modal structure, updating all buttons app-wide
   ```

2. **Add features not requested** ❌
   ```
   Request: "Make appointments page mobile responsive"
   Wrong: While fixing that, also add new appointment creation feature
   ```

3. **Create compound CSS classes** ❌
   ```
   Wrong: `.h-10-border-white-px-3-flex-gap-4`
   Right: `.input-lg` or `.input-field`
   ```

4. **Mix inline Tailwind with semantic classes** ❌
   ```
   Wrong: className="flex gap-2" mixed with `.btn-primary`
   Right: ALL className use only semantic classes from globals.css
   ```

5. **Edit multiple unrelated files** ❌
   ```
   Request: "Fix dashboard title styling"
   Wrong: Edit dashboard/page.tsx AND appointments/page.tsx AND messages/page.tsx
   Right: Edit ONLY dashboard/page.tsx
   ```

6. **Reorganize folder structure without explicit request** ❌
7. **Add new pages/routes without explicit request** ❌
8. **Change database schema without explicit request** ❌
9. **Modify dependencies without explicit request** ❌

---

## Testing Protocol (MANDATORY)

### After EVERY change:
```bash
cd /workspaces/matira-dental-studio/app
npm run dev
# Wait for: "✓ Compiled successfully"
# Fix any build errors IMMEDIATELY
```

### Before considering done:
- [ ] `npm run dev` passes
- [ ] No TypeScript errors
- [ ] Only requested files changed
- [ ] Can view in browser at http://localhost:3000

---

## CSS Class Naming Standards

### ✅ GOOD (Semantic)
- `.btn` - base button
- `.btn-primary` - primary button variant
- `.btn-lg` - large button
- `.input-field` - form input
- `.card-section` - card component
- `.modal-overlay` - modal background
- `.flex-between` - flex with space-between
- `.grid-2col` - 2-column grid

### ❌ BAD (Compound/Unclear)
- `.h-10-save-btn` ❌ (too specific, not reusable)
- `.flex-items-between-gap-2-pt-4` ❌ (compound, should be `.flex-between`)
- `.mt-4-grid-2col-sm` ❌ (mixing concerns)
- `.h-10-border-white-px-3-flex-gap-4` ❌ (inline tailwind as class name)

---

## How to Handle Ambiguous Requests

If the request is unclear or spans multiple concerns, **ASK FIRST**:

```
User: "Clean up the appointments page"
Agent: "That could mean several things:
- Update styling to semantic classes?
- Fix mobile responsiveness?
- Reorganize component structure?
Which would you like me to focus on?"
```

---

## Git Verification

After any changes, this should show ONLY what was requested:
```bash
git diff
# Should show only ~5-20 lines changed in requested files
# Should NOT show reformatting of unrelated code
```

---

## Mobile/Tablet Responsive Requirements

Whenever building OR modifying pages:
- **Mobile (< 640px):** Single column, touch-friendly, readable text
- **Tablet (640px-1024px):** 2 columns where appropriate
- **Desktop (> 1024px):** Multi-column, full layouts

Test breakpoints with:
```bash
# Once npm run dev is running, open browser DevTools
# Toggle device toolbar (Ctrl+Shift+M)
# Test: iPhone SE, iPad, Desktop 1920px
```

---

## Summary

| Task | Do This | NOT This |
|------|---------|----------|
| Edit code | Single file, surgical change | Multiple files, refactoring |
| Create classes | Semantic `.btn-primary` | Compound `.h-10-border-white-px-3` |
| Responsive | Mobile/Tablet/Desktop | Desktop only |
| Test | Run `npm run dev` every time | Skip testing |
| Scope | What was requested | What you think helps |

---

## Questions?
If ANY instruction conflicts with this document, **follow this document.**
