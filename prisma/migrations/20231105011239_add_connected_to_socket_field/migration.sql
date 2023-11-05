/*
  Warnings:

  - Added the required column `connectedSocket` to the `ChatRoom` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `ChatRoom` ADD COLUMN `connectedSocket` VARCHAR(191) NOT NULL;
