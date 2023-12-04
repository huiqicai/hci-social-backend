-- DropForeignKey
ALTER TABLE `Message` DROP FOREIGN KEY `Message_fromUserId_fkey`;

-- AlterTable
ALTER TABLE `Message` ADD COLUMN `toUserId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `idx_message_toUserId` ON `Message`(`toUserId`);

-- RenameIndex
ALTER TABLE `Message` RENAME INDEX `Message_chatRoomId_fkey` TO `idx_message_chatRoomId`;

-- RenameIndex
ALTER TABLE `Message` RENAME INDEX `Message_fromUserId_fkey` TO `idx_message_fromUserId`;
