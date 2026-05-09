-- CreateTable
CREATE TABLE "Gym" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'boulder',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GradeMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gymId" TEXT NOT NULL,
    "localGrade" TEXT NOT NULL,
    "frenchGrade" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "GradeMapping_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ClimbLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionLogId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "gradeSystem" TEXT NOT NULL DEFAULT 'French',
    "localGrade" TEXT,
    "wallColor" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "style" TEXT NOT NULL DEFAULT 'redpoint',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClimbLog_sessionLogId_fkey" FOREIGN KEY ("sessionLogId") REFERENCES "SessionUnitLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ClimbLog" ("attempts", "createdAt", "grade", "gradeSystem", "id", "notes", "sessionLogId", "style", "wallColor") SELECT "attempts", "createdAt", "grade", "gradeSystem", "id", "notes", "sessionLogId", "style", "wallColor" FROM "ClimbLog";
DROP TABLE "ClimbLog";
ALTER TABLE "new_ClimbLog" RENAME TO "ClimbLog";
CREATE TABLE "new_SessionUnitLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "planDayUnitId" TEXT NOT NULL,
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
    CONSTRAINT "SessionUnitLog_planDayUnitId_fkey" FOREIGN KEY ("planDayUnitId") REFERENCES "PlanDayUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionUnitLog_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SessionUnitLog" ("completed", "durationSec", "gripType", "id", "notes", "planDayUnitId", "repsActual", "sessionId", "setsActual", "weightKg") SELECT "completed", "durationSec", "gripType", "id", "notes", "planDayUnitId", "repsActual", "sessionId", "setsActual", "weightKg" FROM "SessionUnitLog";
DROP TABLE "SessionUnitLog";
ALTER TABLE "new_SessionUnitLog" RENAME TO "SessionUnitLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
