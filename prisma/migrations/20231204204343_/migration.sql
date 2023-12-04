/*
  Warnings:

  - You are about to drop the column `connectedToSocket` on the `ChatRoomMembership` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `ChatRoomMembership_connectedToSocket_key` ON `ChatRoomMembership`;

-- DropIndex
DROP INDEX `idx_message_fromUserId` ON `Message`;

-- DropIndex
DROP INDEX `idx_message_toUserId` ON `Message`;

-- AlterTable
ALTER TABLE `ChatRoomMembership` DROP COLUMN `connectedToSocket`;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `User`(`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `User`(`user_id`) ON DELETE SET NULL ON UPDATE CASCADE;
