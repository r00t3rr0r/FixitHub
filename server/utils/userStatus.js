// A user can only log in when `status` is 'active' (email verified or activated by an admin)
// AND `isActive` is true. Admin actions must therefore always write both fields together.
const USER_STATUSES = ['active', 'inactive', 'suspended', 'blocked'];

const isValidUserStatus = (status) => USER_STATUSES.includes(status);

const statusUpdateFor = (status) => ({ status, isActive: status === 'active' });

// Status as the login flow sees it; legacy records without `status` count as active.
const effectiveUserStatus = (user) => {
  const status = user?.status || 'active';
  if (status === 'suspended' || status === 'blocked') return status;
  return status === 'active' && user?.isActive !== false ? 'active' : 'inactive';
};

/**
 * Resolves `status` / `isActive` from an admin update payload into a consistent pair.
 * The edit dialog sends both; whichever differs from the stored value is the admin's change,
 * with `status` taking precedence. Returns {} when neither field changes.
 */
const resolveStatusUpdate = (currentUser, { status, isActive } = {}) => {
  if (isValidUserStatus(status) && status !== (currentUser?.status || 'active')) {
    return statusUpdateFor(status);
  }
  if (typeof isActive === 'boolean' && isActive !== (currentUser?.isActive !== false)) {
    return statusUpdateFor(isActive ? 'active' : 'inactive');
  }
  return {};
};

// Mongo filter for the admin list's status dropdown, matching effectiveUserStatus.
const effectiveStatusFilter = (status) => {
  switch (status) {
    case 'active':
      return { status: { $in: ['active', null] }, isActive: { $ne: false } };
    case 'inactive':
      return {
        status: { $nin: ['suspended', 'blocked'] },
        $or: [{ status: 'inactive' }, { isActive: false }],
      };
    case 'suspended':
    case 'blocked':
      return { status };
    default:
      return null;
  }
};

module.exports = {
  USER_STATUSES,
  isValidUserStatus,
  statusUpdateFor,
  effectiveUserStatus,
  resolveStatusUpdate,
  effectiveStatusFilter,
};
