# Assumptions

- The existing `Frontend/` and `Backend/` folders are the web and API applications. This keeps the repository layout requested while following the specification's two-app monorepo architecture.
- Supabase credentials are intentionally blank in environment templates. The service-role key is read only by the API.
- Demo accounts use temporary password `ChangeMe123!`; force a password change when Phase 1 authentication is implemented. Seed data is for local development only.
- Quiz authoring currently creates single-answer multiple-choice questions through the UI; the API and schema support single-choice, multi-choice, and true/false questions. Quiz attempts are one per student and scored automatically.
- Chat is text-only and refreshes on a short polling interval. Announcement notifications are in-app only; no email provider is configured.
- Complaint attachments and threaded follow-up comments are not included in the current interface. Students can submit complaints and see status/administrator responses; administrators manage status and response.
- Assignment responses support text and private PDF, DOCX, PPTX, or ZIP attachments. The interface does not include a separate assignment-instructions attachment.
- The course and resource lists are paginated. The student marks page currently requests its first 100 records.
