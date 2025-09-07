const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Extract text from different file types
const extractText = async (filePath, fileType) => {
  try {
    if (fileType === "pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } else if (fileType === "docx" || fileType === "doc") {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    }
    throw new Error("Unsupported file type");
  } catch (error) {
    throw new Error(`Error extracting text: ${error.message}`);
  }
};

// Calculate ATS score based on various factors
const calculateATSScore = (cvText, jobDescription = "") => {
  let score = 0;
  const factors = {
    contactInfo: 0,
    skills: 0,
    experience: 0,
    education: 0,
    keywords: 0,
    formatting: 0,
  };

  // Contact information check (20 points)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

  if (emailRegex.test(cvText)) factors.contactInfo += 10;
  if (phoneRegex.test(cvText)) factors.contactInfo += 10;

  // Skills section (25 points)
  const skillKeywords = [
    "skills",
    "technical skills",
    "competencies",
    "expertise",
  ];
  const hasSkillsSection = skillKeywords.some((keyword) =>
    cvText.toLowerCase().includes(keyword.toLowerCase())
  );
  if (hasSkillsSection) factors.skills += 25;

  // Experience section (25 points)
  const experienceKeywords = [
    "experience",
    "work history",
    "employment",
    "career",
  ];
  const hasExperienceSection = experienceKeywords.some((keyword) =>
    cvText.toLowerCase().includes(keyword.toLowerCase())
  );
  if (hasExperienceSection) factors.experience += 25;

  // Education section (15 points)
  const educationKeywords = [
    "education",
    "degree",
    "university",
    "college",
    "certification",
  ];
  const hasEducationSection = educationKeywords.some((keyword) =>
    cvText.toLowerCase().includes(keyword.toLowerCase())
  );
  if (hasEducationSection) factors.education += 15;

  // Job-specific keywords matching (10 points)
  if (jobDescription) {
    const jobWords = jobDescription.toLowerCase().split(/\s+/);
    const cvWords = cvText.toLowerCase().split(/\s+/);
    const matchingWords = jobWords.filter(
      (word) => word.length > 3 && cvWords.includes(word)
    );
    factors.keywords = Math.min(
      10,
      (matchingWords.length / jobWords.length) * 10
    );
  }

  // Formatting check (5 points)
  const hasProperStructure =
    cvText.length > 200 && cvText.split("\n").length > 10;
  if (hasProperStructure) factors.formatting += 5;

  // Calculate total score
  score = Object.values(factors).reduce((sum, value) => sum + value, 0);

  return {
    totalScore: Math.round(score),
    breakdown: factors,
    grade:
      score >= 80
        ? "Excellent"
        : score >= 60
        ? "Good"
        : score >= 40
        ? "Fair"
        : "Poor",
  };
};
// Generate AI-powered CV analysis
const generateAIAnalysis = async (cvText) => {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    const prompt = `
    Analyze this CV/Resume for HR purposes and provide detailed feedback:
    
    CV Content:
    ${cvText}
    
    Please provide:
    1. Overall assessment
    2. Strengths identified
    3. Areas for improvement
    4. Missing elements
    5. Recommendations for better ATS compatibility
    6. Professional summary evaluation
    
    Format your response as a structured analysis.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "AI analysis unavailable. Please check your API configuration.";
  }
};

// Main CV analysis controller
const analyzeCv = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const fileExtension = path
      .extname(req.file.originalname)
      .toLowerCase()
      .substring(1);

    // Extract text from CV
    const cvText = await extractText(filePath, fileExtension);

    // Calculate ATS score
    const atsScore = calculateATSScore(cvText);

    // Generate AI analysis
    const aiAnalysis = await generateAIAnalysis(cvText);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        atsScore: atsScore,
        aiAnalysis: aiAnalysis,
        extractedText: cvText.substring(0, 500) + "...", // Preview only
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("CV Analysis Error:", error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: "Failed to analyze CV",
      details: error.message,
    });
  }
};

// Compare CV with job description
const compareWithJob = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CV file uploaded" });
    }

    const { jobDescription } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ error: "Job description is required" });
    }

    const filePath = req.file.path;
    const fileExtension = path
      .extname(req.file.originalname)
      .toLowerCase()
      .substring(1);

    // Extract text from CV
    const cvText = await extractText(filePath, fileExtension);

    // Calculate ATS score with job description
    const atsScore = calculateATSScore(cvText, jobDescription);

    // Generate comparative AI analysis
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `
    Compare this CV with the job description and provide matching analysis:
    
    CV Content:
    ${cvText}
    
    Job Description:
    ${jobDescription}
    
    Please provide:
    1. Match percentage
    2. Matching skills and qualifications
    3. Missing requirements
    4. Recommendations to improve match
    5. Key strengths for this role
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const comparisonAnalysis = response.text();

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      data: {
        fileName: req.file.originalname,
        atsScore: atsScore,
        comparisonAnalysis: comparisonAnalysis,
        jobDescription: jobDescription,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("CV Comparison Error:", error);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      error: "Failed to compare CV with job description",
      details: error.message,
    });
  }
};

module.exports = {
  analyzeCv,
  compareWithJob,
};
