-- CreateTable
CREATE TABLE `User` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_email` VARCHAR(191) NOT NULL,
    `user_password` VARCHAR(191) NOT NULL,
    `user_attributes` JSON NULL,

    UNIQUE INDEX `User_user_email_key`(`user_email`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `sess_id` VARCHAR(191) NOT NULL,
    `sess_user_id` INTEGER NULL,
    `sess_content` MEDIUMTEXT NOT NULL,
    `sess_flash` MEDIUMTEXT NOT NULL,
    `sess_updated_at` INTEGER NOT NULL,
    `sess_created_at` INTEGER NOT NULL,

    UNIQUE INDEX `Session_sess_id_key`(`sess_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Group` (
    `group_id` INTEGER NOT NULL AUTO_INCREMENT,
    `group_name` MEDIUMTEXT NOT NULL,
    `group_attributes` JSON NULL,

    PRIMARY KEY (`group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupMember` (
    `gm_id` INTEGER NOT NULL AUTO_INCREMENT,
    `gm_member_id` INTEGER NOT NULL,
    `gm_group_id` INTEGER NOT NULL,
    `gm_attributes` JSON NULL,

    PRIMARY KEY (`gm_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Connection` (
    `conn_id` INTEGER NOT NULL AUTO_INCREMENT,
    `conn_from_user_id` INTEGER NOT NULL,
    `conn_to_user_id` INTEGER NOT NULL,
    `conn_attributes` JSON NULL,

    PRIMARY KEY (`conn_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Post` (
    `post_id` INTEGER NOT NULL AUTO_INCREMENT,
    `post_author_id` INTEGER NULL,
    `post_created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `post_updated` DATETIME(3) NOT NULL,
    `post_content` LONGTEXT NOT NULL,
    `post_parent_id` INTEGER NULL,
    `post_recip_user_id` INTEGER NULL,
    `post_recip_group_id` INTEGER NULL,
    `post_attributes` JSON NULL,

    PRIMARY KEY (`post_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PostReaction` (
    `pr_id` INTEGER NOT NULL AUTO_INCREMENT,
    `pr_post_id` INTEGER NOT NULL,
    `pr_reactor_id` INTEGER NULL,
    `pr_name` MEDIUMTEXT NOT NULL,
    `pr_value` INTEGER NULL,
    `pr_attributes` JSON NULL,

    PRIMARY KEY (`pr_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `File` (
    `file_id` INTEGER NOT NULL AUTO_INCREMENT,
    `file_uploader_id` INTEGER NULL,
    `file_path` TEXT NOT NULL,
    `file_size` INTEGER NOT NULL,
    `file_attributes` JSON NULL,

    PRIMARY KEY (`file_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_sess_user_id_fkey` FOREIGN KEY (`sess_user_id`) REFERENCES `User`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_gm_member_id_fkey` FOREIGN KEY (`gm_member_id`) REFERENCES `User`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMember` ADD CONSTRAINT `GroupMember_gm_group_id_fkey` FOREIGN KEY (`gm_group_id`) REFERENCES `Group`(`group_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Connection` ADD CONSTRAINT `Connection_conn_from_user_id_fkey` FOREIGN KEY (`conn_from_user_id`) REFERENCES `User`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Connection` ADD CONSTRAINT `Connection_conn_to_user_id_fkey` FOREIGN KEY (`conn_to_user_id`) REFERENCES `User`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_post_author_id_fkey` FOREIGN KEY (`post_author_id`) REFERENCES `User`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_post_parent_id_fkey` FOREIGN KEY (`post_parent_id`) REFERENCES `Post`(`post_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_post_recip_user_id_fkey` FOREIGN KEY (`post_recip_user_id`) REFERENCES `User`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_post_recip_group_id_fkey` FOREIGN KEY (`post_recip_group_id`) REFERENCES `Group`(`group_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostReaction` ADD CONSTRAINT `PostReaction_pr_post_id_fkey` FOREIGN KEY (`pr_post_id`) REFERENCES `Post`(`post_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PostReaction` ADD CONSTRAINT `PostReaction_pr_reactor_id_fkey` FOREIGN KEY (`pr_reactor_id`) REFERENCES `User`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_file_uploader_id_fkey` FOREIGN KEY (`file_uploader_id`) REFERENCES `User`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
