/*
  Warnings:

  - You are about to drop the column `gradeSystem` on the `ClimbLog` table. All the data in the column will be lost.
  - You are about to drop the column `localGrade` on the `ClimbLog` table. All the data in the column will be lost.
  - You are about to drop the column `frenchGrade` on the `GradeMapping` table. All the data in the column will be lost.
  - Added the required column `userId` to the `Gym` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `PlanDay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trainingUnitId` to the `SessionUnitLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `TrainingSession` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `TrainingUnit` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrainingCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "climbingType" TEXT,
    "grade" TEXT,
    "gymGradeOrder" INTEGER,
    "attempts" INTEGER,
    "success" BOOLEAN,
    "style" TEXT,
    "distanceKm" REAL,
    "pace" REAL,
    "durationMin" INTEGER,
    "gymId" TEXT,
    "name" TEXT,
    "data" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Activity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Retrospective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Retrospective_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "TrainingCycle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Retrospective_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClimbLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionLogId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "gymGradeOrder" INTEGER,
    "wallColor" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "style" TEXT NOT NULL DEFAULT 'redpoint',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClimbLog_sessionLogId_fkey" FOREIGN KEY ("sessionLogId") REFERENCES "SessionUnitLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ClimbLog" ("attempts", "createdAt", "grade", "id", "notes", "sessionLogId", "style", "wallColor") SELECT "attempts", "createdAt", "grade", "id", "notes", "sessionLogId", "style", "wallColor" FROM "ClimbLog";
DROP TABLE "ClimbLog";
ALTER TABLE "new_ClimbLog" RENAME TO "ClimbLog";
CREATE TABLE "new_GradeMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gymId" TEXT NOT NULL,
    "localGrade" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "GradeMapping_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GradeMapping" ("gymId", "id", "localGrade", "order") SELECT "gymId", "id", "localGrade", "order" FROM "GradeMapping";
DROP TABLE "GradeMapping";
ALTER TABLE "new_GradeMapping" RENAME TO "GradeMapping";
CREATE TABLE "new_Gym" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'boulder',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gym_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Gym" ("createdAt", "id", "name", "type") SELECT "createdAt", "id", "name", "type" FROM "Gym";
DROP TABLE "Gym";
ALTER TABLE "new_Gym" RENAME TO "Gym";
CREATE TABLE "new_PlanDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PlanDay" ("createdAt", "dayNumber", "id", "name", "updatedAt") SELECT "createdAt", "dayNumber", "id", "name", "updatedAt" FROM "PlanDay";
DROP TABLE "PlanDay";
ALTER TABLE "new_PlanDay" RENAME TO "PlanDay";
CREATE UNIQUE INDEX "PlanDay_userId_dayNumber_key" ON "PlanDay"("userId", "dayNumber");
CREATE TABLE "new_SessionUnitLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "trainingUnitId" TEXT NOT NULL,
    "planDayUnitId" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "repsActual" INTEGER,
    "setsActual" INTEGER,
    "durationSec" INTEGER,
    "distanceM" REAL,
    "weightKg" REAL,
    "gripType" TEXT,
    "gymId" TEXT,
    CONSTRAINT "SessionUnitLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionUnitLog_trainingUnitId_fkey" FOREIGN KEY ("trainingUnitId") REFERENCES "TrainingUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionUnitLog_planDayUnitId_fkey" FOREIGN KEY ("planDayUnitId") REFERENCES "PlanDayUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SessionUnitLog_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SessionUnitLog" ("completed", "distanceM", "durationSec", "gripType", "gymId", "id", "notes", "planDayUnitId", "repsActual", "sessionId", "setsActual", "weightKg") SELECT "completed", "distanceM", "durationSec", "gripType", "gymId", "id", "notes", "planDayUnitId", "repsActual", "sessionId", "setsActual", "weightKg" FROM "SessionUnitLog";
DROP TABLE "SessionUnitLog";
ALTER TABLE "new_SessionUnitLog" RENAME TO "SessionUnitLog";
CREATE TABLE "new_TrainingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "cycleId" TEXT,
    "planDayId" TEXT,
    "cycleNumber" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "completedAt" DATETIME,
    "rpe" INTEGER,
    "fingersBefore" INTEGER,
    "bicepsBefore" INTEGER,
    "shouldersBefore" INTEGER,
    "fatigueBefore" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingSession_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "TrainingCycle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingSession_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TrainingSession" ("completedAt", "createdAt", "date", "id", "notes", "planDayId", "updatedAt") SELECT "completedAt", "createdAt", "date", "id", "notes", "planDayId", "updatedAt" FROM "TrainingSession";
DROP TABLE "TrainingSession";
ALTER TABLE "new_TrainingSession" RENAME TO "TrainingSession";
CREATE UNIQUE INDEX "TrainingSession_userId_date_key" ON "TrainingSession"("userId", "date");
CREATE TABLE "new_TrainingUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingUnit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TrainingUnit" ("createdAt", "description", "id", "name", "type", "updatedAt") SELECT "createdAt", "description", "id", "name", "type", "updatedAt" FROM "TrainingUnit";
DROP TABLE "TrainingUnit";
ALTER TABLE "new_TrainingUnit" RENAME TO "TrainingUnit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Retrospective_cycleId_key" ON "Retrospective"("cycleId");
