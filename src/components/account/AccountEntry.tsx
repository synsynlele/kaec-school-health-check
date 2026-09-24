import { AccountAccess } from "@/components/account/AccountAccess";

/**
 * The account route is the explicit school/account context.
 *
 * Platform-admin authority is an additional permission, not a forced product
 * destination. A Super Admin who deliberately opens /account must be allowed
 * to work as a school/account user without being bounced back into /khpos/admin.
 */
export function AccountEntry() {
  return <AccountAccess />;
}
