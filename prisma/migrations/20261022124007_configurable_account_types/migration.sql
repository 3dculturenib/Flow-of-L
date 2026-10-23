/*
  Warnings:

  - The `type` column on the `Account` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Account" DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Bank account';

-- DropEnum
DROP TYPE "AccountType";
