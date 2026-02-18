# CSS & Component Standardization Plan

## Current State Analysis

### ✅ What Already Exists in `globals.css`
- `.app-section` (max-w-7xl, mx-auto, px-4, py-6)
- `.app-section-header`, `.app-section-title`, `.app-section-subtitle`, `.app-section-body`
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`
- `.tabs`, `.tab-item`, `.tab-item-active`
- `.form-group`, `.form-label`, `.form-input`, `.form-textarea`, `.form-select`
- `.data-table*` classes for tables
- `.patient-tabs-sticky` for sticky tabs

### ❌ Current Issues - INLINE STYLES FOUND

#### **Table Column Widths (BIGGEST OFFENDER)**
Found in 8+ files - all using `style={{ width: "X%" }}`
- `/patients/[id]/billing/page.tsx` - lines 642-648, 738-744
- `/patients/[id]/documents/page.tsx` - lines 410-413
- `/patients/[id]/chart/page.tsx` - lines 480-484
- `/patients/[id]/attachments/page.tsx` - lines 268-271
- `/settings/team/page.tsx` - lines 443-448, 532-536
- `/settings/services/page.tsx` - lines 261-265
- `/settings/payment-modes/page.tsx` - lines 164-169

#### **Color Styling (Conditional)**
- `/patients/[id]/billing/page.tsx` line 674: `style={{ color: balance > 0 ? "#dc2626" : "#16a34a" }}`

#### **Scrollable Divs**
- `/settings/services/page.tsx` line 348: `style={{ maxHeight: '150px', overflowY: 'auto' }}`

### ❌ Current Issues - WRAPPER DIVS WITHOUT STANDARDS

**Common Patterns Found:**
1. Modal wrappers: `<div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">`
   - Found in: `/messages/LinkPatientModal.tsx`, `/messages/AppointmentModal.tsx`, `/reports/appointments/page.tsx`

2. Button groups: `<div className="flex gap-2">` or `<div className="flex gap-3">`
   - Scattered everywhere (no consistent spacing)

3. Header sections: `<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">`
   - Found in: `/patients/page.tsx`, `/appointments/page.tsx`

4. Form sections: no standard wrapper classes

---

## 🎯 Standardization Tasks

### Phase 1: Add CSS Classes to `globals.css`

#### A. Wrapper/Section Classes
```css
/* Wrapper standards */
.section-header { /* for header with title + actions */ }
.section-body { /* for main content area */ }
.button-group { /* flex with consistent gap */ }
.form-section { /* wrapper for form fields */ }
.modal-wrapper { /* standard modal container */ }
.modal-header { /* modal title bar */ }
.modal-body { /* modal content */ }
.modal-footer { /* modal actions */ }

/* Table column width utilities */
.col-10 { width: 10%; }
.col-12 { width: 12%; }
.col-13 { width: 13%; }
.col-14 { width: 14%; }
.col-15 { width: 15%; }
.col-16 { width: 16%; }
.col-17 { width: 17%; }
.col-18 { width: 18%; }
.col-20 { width: 20%; }
.col-25 { width: 25%; }
.col-30 { width: 30%; }
.col-35 { width: 35%; }
.col-50 { width: 50%; }

/* Scroll utilities */
.scrollable { maxHeight: auto; overflow-y: auto; }
.scrollable-md { maxHeight: 150px; overflow-y: auto; }
.scrollable-lg { maxHeight: 300px; overflow-y: auto; }

/* Color utilities for dynamic styling */
.text-status-error { color: #dc2626; }
.text-status-success { color: #16a34a; }
```

### Phase 2: Create Reusable Components

#### B. `Button.tsx` Component
- Props: variant (primary, secondary, danger, ghost), size, onClick, disabled, children
- Replace all `className="btn btn-primary"` usage

#### C. `Modal.tsx` Component
- Props: open, onClose, title, children, footer?, size?
- Standard structure: header + body + footer
- Handle backdrop click & escape key with `useModalBackdrop` hook
- Replace all inline modal wrappers

#### D. `Card.tsx` Component
- Props: children, className?
- Standard: `bg-white rounded-lg border border-slate-200 p-4`

#### E. `FormField.tsx` Component
- Props: label, error, children (input)
- Standard structure with label + input + error text

#### F. `SectionWrapper.tsx` Component
- Props: title?, subtitle?, children, actions? (header + body)
- Uses `.app-section`, `.section-header`, `.section-body`

---

## 📊 Pages Using Non-Standard Patterns (Priority Order)

### **CRITICAL** (Most inline styles)
1. ✗ `/patients/[id]/billing/page.tsx` - 9 inline col widths + 1 color style
2. ✗ `/settings/team/page.tsx` - 11 inline col widths
3. ✗ `/patients/[id]/chart/page.tsx` - 5 inline col widths

### **HIGH** (Modal standardization)
4. ✗ `/messages/LinkPatientModal.tsx` - custom modal div
5. ✗ `/messages/AppointmentModal.tsx` - custom modal div
6. ✗ `/reports/appointments/page.tsx` - inline modal div

### **MEDIUM** (Wrapper standardization)
7. ✗ `/patients/page.tsx` - multiple button-group patterns
8. ✗ `/appointments/page.tsx` - multiple header/wrapper patterns
9. ✗ `/settings/services/page.tsx` - 5 col widths + 1 scrollable div
10. ✗ `/settings/payment-modes/page.tsx` - 6 inline col widths
11. ✗ `/patients/[id]/documents/page.tsx` - 4 inline col widths
12. ✗ `/patients/[id]/attachments/page.tsx` - 4 inline col widths

### **MEDIUM** (Messages module)
13. ✗ `/messages/LinkPatientModal.tsx` - wrapper divs
14. ✗ `/messages/AppointmentModal.tsx` - wrapper divs
15. ✗ `/messages/ChatWindow.tsx` - wrapper divs
16. ✗ `/messages/page.tsx` - wrapper divs

### **LOW** (Minor updates)
17. ✗ `/reports/bulk-payments/page.tsx` - wrapper divs
18. ✗ `/reports/clinic-performance/page.tsx` - check for consistency
19. ✗ `/reports/patient-revenue/page.tsx` - check for consistency
20. ✗ `/reports/payments/page.tsx` - check for consistency
21. ✗ `/reports/treatment-analytics/page.tsx` - check for consistency
22. ✗ `/settings/clinic-profile/page.tsx` - wrapper divs
23. ✗ `/settings/document-templates/page.tsx` - check for consistency

---

## Implementation Steps

### Step 1: Update `globals.css` ✓ (Ready)
- Add all wrapper classes
- Add table column width utilities
- Add scroll utilities
- Add color text utilities

### Step 2: Create Reusable Components (Priority: Button → Modal → Card → FormField → SectionWrapper)

### Step 3: Refactor Pages
- Start with `patients/[id]/billing/page.tsx` (most violations)
- Move to `settings/team/page.tsx`
- Move to `patients/[id]/chart/page.tsx`
- Then modals & message components
- Test each page after refactor

### Step 4: Validation
- Run `npm run dev` on each refactored page
- Check for visual regressions
- Verify button interactions
- Verify modal backdrop behaviors
- Run `npm run lint`

---

## Expected Outcomes

✅ **Clean Code:** No inline `style={{}}` anywhere  
✅ **Consistent Spacing:** All buttons use `.button-group` with gap-2 or gap-3  
✅ **Reusable:** 80% less boilerplate in pages  
✅ **Maintainable:** Single source of truth for each UI pattern  
✅ **Accessible:** Modal component handles focus & keyboard shortcuts  

---

## Files to Create/Modify

### New Components
- `/app/src/components/Button.tsx`
- `/app/src/components/Modal.tsx`
- `/app/src/components/Card.tsx`
- `/app/src/components/FormField.tsx`
- `/app/src/components/SectionWrapper.tsx`

### Update CSS
- `/app/src/app/globals.css` - Add wrapper classes + utilities

### Refactor Pages (23 files listed above)

---
