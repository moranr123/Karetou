# How to Change Account Deactivation Time Threshold

This guide explains how to modify the time threshold for account deactivation in the admin panel.

## Overview

The system automatically identifies accounts (users and admins) that need deactivation based on their last logout time. Currently, accounts that haven't logged out for more than **1 minute** are flagged as needing deactivation.

## Current Configuration

The deactivation check is based on the `lastLogin` field (which stores logout time) and compares it against the current time. If the difference exceeds the threshold, the account is marked as needing deactivation.

## Files to Modify

You need to update the `needsDeactivation` function in **two files**:

1. `admin-panel/src/pages/UserManagement.tsx`
2. `admin-panel/src/pages/AdminManagement.tsx`

Additionally, if you want the dashboard notification to use the same threshold:

3. `admin-panel/src/pages/SuperAdminDashboard.tsx`

## Step-by-Step Instructions

### 1. Modify User Management

**File:** `admin-panel/src/pages/UserManagement.tsx`

**Location:** Find the `needsDeactivation` function (around line 61)

**Current Code:**
```typescript
const needsDeactivation = (user: User): boolean => {
  if (!user.lastLogin) {
    // If no lastLogin (logout time) recorded, don't show needs deactivation
    return false;
  }
  const lastLogoutDate = new Date(user.lastLogin); // lastLogin now stores logout time
  const minutesSinceLogout = (new Date().getTime() - lastLogoutDate.getTime()) / (1000 * 60);
  return minutesSinceLogout > 1;
};
```

**To Change the Threshold:**

Replace `> 1` with your desired threshold. Examples:

- **7 days:** `return minutesSinceLogout > (7 * 24 * 60);`
- **30 days:** `return minutesSinceLogout > (30 * 24 * 60);`
- **1 hour:** `return minutesSinceLogout > 60;`
- **1 week:** `return minutesSinceLogout > (7 * 24 * 60);`

**Example for 7 days:**
```typescript
const needsDeactivation = (user: User): boolean => {
  if (!user.lastLogin) {
    return false;
  }
  const lastLogoutDate = new Date(user.lastLogin);
  const minutesSinceLogout = (new Date().getTime() - lastLogoutDate.getTime()) / (1000 * 60);
  return minutesSinceLogout > (7 * 24 * 60); // 7 days in minutes
};
```

### 2. Modify Admin Management

**File:** `admin-panel/src/pages/AdminManagement.tsx`

**Location:** Find the `needsDeactivation` function (around line 82)

**Current Code:**
```typescript
const needsDeactivation = (admin: AdminUser): boolean => {
  if (!admin.lastLogin) {
    // If no lastLogin (logout time) recorded, don't show needs deactivation
    return false;
  }
  const lastLogoutDate = new Date(admin.lastLogin); // lastLogin now stores logout time
  const minutesSinceLogout = (new Date().getTime() - lastLogoutDate.getTime()) / (1000 * 60);
  return minutesSinceLogout > 1;
};
```

**Apply the same change** as in User Management (use the same threshold value).

### 3. Modify Dashboard Notification (Optional)

**File:** `admin-panel/src/pages/SuperAdminDashboard.tsx`

**Location:** Find the `needsDeactivation` function (around line 138)

**Current Code:**
```typescript
const needsDeactivation = (lastLogin: string | undefined): boolean => {
  if (!lastLogin) {
    return false;
  }
  const lastLogoutDate = new Date(lastLogin);
  const minutesSinceLogout = (new Date().getTime() - lastLogoutDate.getTime()) / (1000 * 60);
  return minutesSinceLogout > 1;
};
```

**Apply the same threshold** to keep the dashboard notification consistent.

## Time Conversion Reference

Use this reference to convert your desired time period to minutes:

| Time Period | Minutes | Code |
|------------|---------|------|
| 1 minute | 1 | `> 1` |
| 1 hour | 60 | `> 60` |
| 1 day | 1,440 | `> (24 * 60)` |
| 7 days | 10,080 | `> (7 * 24 * 60)` |
| 30 days | 43,200 | `> (30 * 24 * 60)` |
| 90 days | 129,600 | `> (90 * 24 * 60)` |

## Recommended Configuration

For production environments, we recommend:

- **7 days** for regular users
- **30 days** for business owners
- **90 days** for admins

However, you can use the same threshold for all account types if preferred.

## Example: Setting to 7 Days

Here's a complete example for all three files using a 7-day threshold:

### UserManagement.tsx
```typescript
const needsDeactivation = (user: User): boolean => {
  if (!user.lastLogin) {
    return false;
  }
  const lastLogoutDate = new Date(user.lastLogin);
  const minutesSinceLogout = (new Date().getTime() - lastLogoutDate.getTime()) / (1000 * 60);
  return minutesSinceLogout > (7 * 24 * 60); // 7 days
};
```

### AdminManagement.tsx
```typescript
const needsDeactivation = (admin: AdminUser): boolean => {
  if (!admin.lastLogin) {
    return false;
  }
  const lastLogoutDate = new Date(admin.lastLogin);
  const minutesSinceLogout = (new Date().getTime() - lastLogoutDate.getTime()) / (1000 * 60);
  return minutesSinceLogout > (7 * 24 * 60); // 7 days
};
```

### SuperAdminDashboard.tsx
```typescript
const needsDeactivation = (lastLogin: string | undefined): boolean => {
  if (!lastLogin) {
    return false;
  }
  const lastLogoutDate = new Date(lastLogin);
  const minutesSinceLogout = (new Date().getTime() - lastLogoutDate.getTime()) / (1000 * 60);
  return minutesSinceLogout > (7 * 24 * 60); // 7 days
};
```

## Testing

After making changes:

1. **Restart the development server** if running
2. **Test with a test account:**
   - Log in as a user/admin
   - Log out
   - Wait for the threshold time to pass
   - Check if the "Needs Deactivation" status appears

## Important Notes

- ⚠️ **The current threshold is set to 1 minute for testing purposes**
- ⚠️ **Remember to change it to a production-appropriate value (e.g., 7 days) before deploying**
- ⚠️ **The threshold is based on logout time, not login time**
- ⚠️ **Accounts without a `lastLogin` value (never logged out) will not show as needing deactivation**
- ⚠️ **The system does NOT automatically deactivate accounts - it only shows the "Needs Deactivation" status**

## Troubleshooting

### Issue: Changes not taking effect
- Make sure you've updated all three files
- Restart the development server
- Clear browser cache

### Issue: Accounts showing as needing deactivation immediately
- Check that you're using the correct time calculation
- Verify the threshold value is correct (remember it's in minutes)

### Issue: Accounts never showing as needing deactivation
- Ensure the account has a `lastLogin` value (they must have logged out at least once)
- Check that the threshold value is not too large

## Additional Customization

If you want different thresholds for different account types, you can modify the function to accept additional parameters:

```typescript
const needsDeactivation = (user: User, thresholdDays: number = 7): boolean => {
  if (!user.lastLogin) {
    return false;
  }
  const lastLogoutDate = new Date(user.lastLogin);
  const minutesSinceLogout = (new Date().getTime() - lastLogoutDate.getTime()) / (1000 * 60);
  return minutesSinceLogout > (thresholdDays * 24 * 60);
};
```

Then call it with different thresholds:
- Regular users: `needsDeactivation(user, 7)`
- Business owners: `needsDeactivation(user, 30)`
- Admins: `needsDeactivation(admin, 90)`

---

**Last Updated:** 2024
**Current Threshold:** 1 minute (for testing)
**Recommended Production Threshold:** 7 days

