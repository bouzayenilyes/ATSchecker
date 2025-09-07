// Detect if we're running from file:// or server
const API_BASE_URL =
  window.location.protocol === "file:"
    ? "http://localhost:3000/api/cv"
    : "/api/cv";

// DOM Elements
const cvForm = document.getElementById("cvForm");
const cvFile = document.getElementById("cvFile");
const fileLabel = document.querySelector(".file-label span");
const analysisOptions = document.querySelectorAll('input[name="analysisType"]');
const jobDescriptionSection = document.getElementById("jobDescriptionSection");
const loadingSection = document.getElementById("loadingSection");
const resultsSection = document.getElementById("resultsSection");
const newAnalysisBtn = document.getElementById("newAnalysis");

// Event Listeners
cvFile.addEventListener("change", handleFileSelect);
analysisOptions.forEach((option) => {
  option.addEventListener("change", handleAnalysisTypeChange);
});
cvForm.addEventListener("submit", handleFormSubmit);
newAnalysisBtn.addEventListener("click", resetForm);

// Handle file selection
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    fileLabel.textContent = file.name;
    fileLabel.parentElement.style.borderColor = "#667eea";
    fileLabel.parentElement.style.background = "#f0f4ff";
  }
}

// Handle analysis type change
function handleAnalysisTypeChange(event) {
  const isComparison = event.target.value === "comparison";
  jobDescriptionSection.style.display = isComparison ? "block" : "none";

  if (isComparison) {
    document.getElementById("jobDescription").required = true;
  } else {
    document.getElementById("jobDescription").required = false;
  }
}

// Handle form submission
async function handleFormSubmit(event) {
  event.preventDefault();

  const formData = new FormData();
  const file = cvFile.files[0];
  const analysisType = document.querySelector(
    'input[name="analysisType"]:checked'
  ).value;
  const jobDescription = document.getElementById("jobDescription").value;

  if (!file) {
    showError("Please select a CV file");
    return;
  }

  if (analysisType === "comparison" && !jobDescription.trim()) {
    showError("Please provide a job description for comparison");
    return;
  }

  formData.append("cv", file);
  if (analysisType === "comparison") {
    formData.append("jobDescription", jobDescription);
  }

  try {
    showLoading();

    const endpoint = analysisType === "comparison" ? "/compare" : "/analyze";

    // First check if server is running
    try {
      const healthCheck = await fetch(
        API_BASE_URL.replace("/api/cv", "/api/health")
      );
      if (!healthCheck.ok) {
        throw new Error(
          "Server is not running. Please start the backend server."
        );
      }
    } catch (healthError) {
      throw new Error(
        "Cannot connect to server. Please ensure the backend is running on port 3000."
      );
    }

    const response = await fetch(API_BASE_URL + endpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    if (result.success) {
      displayResults(result.data, analysisType);
    } else {
      throw new Error(result.error || "Analysis failed");
    }
  } catch (error) {
    console.error("Error:", error);
    showError(error.message || "Failed to analyze CV. Please try again.");
    hideLoading();
  }
}

// Show loading state
function showLoading() {
  document.querySelector(".upload-section").style.display = "none";
  resultsSection.style.display = "none";
  loadingSection.style.display = "flex";
}

// Hide loading state
function hideLoading() {
  loadingSection.style.display = "none";
}

// Display results
function displayResults(data, analysisType) {
  hideLoading();

  // Update score display
  const scoreValue = document.getElementById("scoreValue");
  const scoreGrade = document.getElementById("scoreGrade");
  const fileName = document.getElementById("fileName");

  scoreValue.textContent = data.atsScore.totalScore;
  scoreGrade.textContent = data.atsScore.grade;
  fileName.textContent = data.fileName;

  // Update score circle color based on grade
  const scoreCircle = document.querySelector(".score-circle");
  const score = data.atsScore.totalScore;
  const percentage = (score / 100) * 360;

  let color1, color2;
  if (score >= 80) {
    color1 = "#48bb78";
    color2 = "#38a169";
  } else if (score >= 60) {
    color1 = "#ed8936";
    color2 = "#dd6b20";
  } else {
    color1 = "#f56565";
    color2 = "#e53e3e";
  }

  scoreCircle.style.background = `conic-gradient(${color1} 0deg, ${color2} ${percentage}deg, #e2e8f0 ${percentage}deg)`;

  // Display score breakdown
  displayScoreBreakdown(data.atsScore.breakdown);

  // Display AI analysis
  const aiAnalysisContent = document.getElementById("aiAnalysis");
  if (analysisType === "comparison") {
    aiAnalysisContent.textContent =
      data.comparisonAnalysis || "No analysis available";
  } else {
    aiAnalysisContent.textContent = data.aiAnalysis || "No analysis available";
  }

  // Show results section
  resultsSection.style.display = "block";

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: "smooth" });
}

// Display score breakdown
function displayScoreBreakdown(breakdown) {
  const breakdownContainer = document.getElementById("scoreBreakdown");
  breakdownContainer.innerHTML = "";

  const categories = {
    contactInfo: "Contact Information",
    skills: "Skills Section",
    experience: "Work Experience",
    education: "Education",
    keywords: "Keyword Matching",
    formatting: "Formatting & Structure",
  };

  Object.entries(breakdown).forEach(([key, value]) => {
    const item = document.createElement("div");
    item.className = "breakdown-item";

    const maxScores = {
      contactInfo: 20,
      skills: 25,
      experience: 25,
      education: 15,
      keywords: 10,
      formatting: 5,
    };

    item.innerHTML = `
            <span>${categories[key] || key}</span>
            <span>${Math.round(value)}/${maxScores[key] || 0}</span>
        `;

    breakdownContainer.appendChild(item);
  });
}

// Show error message
function showError(message) {
  alert(message); // Simple error handling - could be improved with custom modal
}

// Reset form for new analysis
function resetForm() {
  cvForm.reset();
  fileLabel.textContent = "Choose CV File";
  fileLabel.parentElement.style.borderColor = "#cbd5e0";
  fileLabel.parentElement.style.background = "#f7fafc";
  jobDescriptionSection.style.display = "none";
  resultsSection.style.display = "none";
  document.querySelector(".upload-section").style.display = "flex";
}

// File drag and drop functionality
const fileUpload = document.querySelector(".file-upload");

fileUpload.addEventListener("dragover", (e) => {
  e.preventDefault();
  fileUpload.style.borderColor = "#667eea";
  fileUpload.style.background = "#f0f4ff";
});

fileUpload.addEventListener("dragleave", (e) => {
  e.preventDefault();
  fileUpload.style.borderColor = "#cbd5e0";
  fileUpload.style.background = "#f7fafc";
});

fileUpload.addEventListener("drop", (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    cvFile.files = files;
    handleFileSelect({ target: { files } });
  }
  fileUpload.style.borderColor = "#cbd5e0";
  fileUpload.style.background = "#f7fafc";
});
