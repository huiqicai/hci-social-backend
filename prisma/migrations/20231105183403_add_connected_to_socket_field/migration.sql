/*
  Warnings:

  - You are about to drop the column `connectedSocket` on the `ChatRoom` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[connectedToSocket]` on the table `ChatRoomMembership` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `ChatRoom` DROP COLUMN `connectedSocket`;

-- AlterTable
ALTER TABLE `ChatRoomMembership` MODIFY `connectedToSocket` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ChatRoomMembership_connectedToSocket_key` ON `ChatRoomMembership`(`connectedToSocket`);
