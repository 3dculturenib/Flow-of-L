-- AlterTable
ALTER TABLE "Account" DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'Bank account';

-- DropEnum
DROP TYPE "AccountType";
