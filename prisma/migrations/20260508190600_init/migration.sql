-- CreateTable
CREATE TABLE "TrainingUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dayNumber" INTEGER NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlanDayUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planDayId" TEXT NOT NULL,
    "trainingUnitId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "targetReps" INTEGER,
    "targetSets" INTEGER,
    "timesPerDay" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    CONSTRAINT "PlanDayUnit_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanDayUnit_trainingUnitId_fkey" FOREIGN KEY ("trainingUnitId") REFERENCES "TrainingUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "planDayId" TEXT NOT NULL,
    "notes" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingSession_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionUnitLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "planDayUnitId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "repsActual" INTEGER,
    "setsActual" INTEGER,
    "durationSec" INTEGER,
    "weightKg" REAL,
    "gripType" TEXT,
    CONSTRAINT "SessionUnitLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionUnitLog_planDayUnitId_fkey" FOREIGN KEY ("planDayUnitId") REFERENCES "PlanDayUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClimbLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionLogId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "gradeSystem" TEXT NOT NULL,
    "wallColor" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "style" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClimbLog_sessionLogId_fkey" FOREIGN KEY ("sessionLogId") REFERENCES "SessionUnitLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanDay_dayNumber_key" ON "PlanDay"("dayNumber");
