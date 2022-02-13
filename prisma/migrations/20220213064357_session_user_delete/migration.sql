-- DropForeignKey
ALTER TABLE `Session` DROP FOREIGN KEY `Session_sess_user_id_fkey`;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_sess_user_id_fkey` FOREIGN KEY (`sess_user_id`) REFERENCES `User`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
