ALTER TABLE `collaboration_invite`
  MODIFY `email` varchar(255) NULL;
--> statement-breakpoint
ALTER TABLE `collaboration_invite`
  ADD `claimed_user_id` varchar(36) NULL,
  ADD `claimed_at` datetime(3) NULL;
--> statement-breakpoint
ALTER TABLE `collaboration_invite`
  ADD CONSTRAINT `collaboration_invite_claimed_user_id_auth_user_id_fk`
  FOREIGN KEY (`claimed_user_id`) REFERENCES `auth_user`(`id`)
  ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE `email_otp_request` (
  `id` varchar(36) NOT NULL,
  `email` varchar(255) NOT NULL,
  `purpose` enum('invite_activation','collaborator_login','owner_recovery') NOT NULL,
  `ip_address` varchar(64) NOT NULL,
  `requested_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `email_otp_request_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `email_otp_request_email_time_idx`
  ON `email_otp_request` (`email`,`requested_at`);
--> statement-breakpoint
CREATE INDEX `email_otp_request_ip_time_idx`
  ON `email_otp_request` (`ip_address`,`requested_at`);
