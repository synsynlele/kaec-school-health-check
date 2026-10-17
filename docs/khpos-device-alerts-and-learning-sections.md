# Device alert sound and learning sections

## Device alerts

The notification worker requests a fresh alert when a reminder replaces an older notification with the same school tag. It explicitly requests non-silent delivery and a short vibration pattern, while leaving Android/browser policy in control. No unsupported `sound` URL, media autoplay or custom ringtone is used. Existing per-day server deduplication and delivery windows remain unchanged.

Open the notification bell, grant device notifications, then choose **Test device alert**. This locally displays a notification through the service worker. It does not prove background server delivery, audibility, subscription health or a phone's sound settings. Long-press a notification to open its actual Android category, select Alerting, choose a notification sound, check notification volume and Do Not Disturb. Depending on installed TWA delegation/browser behaviour the category may belong to KHP-OS or Chrome/site settings. The web app cannot override a silent/blocked category.

The notification-only worker activates updates immediately; it has no fetch cache. Routine website releases reach the installed TWA without a new Play Store binary. No Android release was generated or submitted for this change.

## Learning sections

Open **More → People & roles → Team & Roles → Learning sections**. A School Custodian or appropriately scoped School Guardian can add, rename, classify, deactivate or restore sections in an existing active campus. Available stages are Preschool/early years, Lower Primary, Upper Primary, Junior Secondary, Senior Secondary and Other/school-defined. Custom names support creche, nursery and school-specific structures. No sections or campuses are automatically created or activated by the migration.

Sections use the existing `khpos_ops_units` records, so staff appointments, teaching streams, learner progress, announcements and Reports can select the same school/campus section after refresh. Generic class and learning-area fields accept nursery, primary and secondary names. WorldReady remains a clearly identified final-year secondary programme, not a preschool curriculum.

Rename/restore preserve IDs and historical records. Duplicate names within a campus, stale edits and cross-school/campus management are rejected. Deactivation is blocked while active staff, current positions or draft/approved/active teaching streams still use the section. Reassignment uses the existing governed controls. School membership and current leadership scope are checked by service-only RPCs; client execution is revoked. Each change is audited.

Schema: `20261017181306_school_learning_sections.sql`. Tests: `npm run test:notification-sound` and `npm run test:learning-sections`, plus the full regression/lint/type/build checks. Apply and verify the migration before deploying the section-management API/UI.
