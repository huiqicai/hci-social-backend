-- DropForeignKey
ALTER TABLE `Post` DROP FOREIGN KEY `Post_post_recip_group_id_fkey`;

-- DropForeignKey
ALTER TABLE `Post` DROP FOREIGN KEY `Post_post_recip_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `Session` DROP FOREIGN KEY `Session_sess_user_id_fkey`;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_sess_user_id_fkey` FOREIGN KEY (`sess_user_id`) REFERENCES `User`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_post_recip_user_id_fkey` FOREIGN KEY (`post_recip_user_id`) REFERENCES `User`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_post_recip_group_id_fkey` FOREIGN KEY (`post_recip_group_id`) REFERENCES `Group`(`group_id`) ON DELETE CASCADE ON UPDATE CASCADE;
