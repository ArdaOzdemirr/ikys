-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "cvExperienceYears" INTEGER,
ADD COLUMN     "cvLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cvParseError" TEXT,
ADD COLUMN     "cvParsedAt" TIMESTAMP(3),
ADD COLUMN     "cvSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "cvSummary" TEXT;
