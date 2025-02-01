document.addEventListener("DOMContentLoaded", () => {
    const uploadResumeForm = document.querySelector("form");

    if (uploadResumeForm) {
        uploadResumeForm.addEventListener("submit", (e) => {
            // Retrieve input values
            const name = document.getElementById("name").value.trim();
            const email = document.getElementById("email").value.trim();
            const skills = document.getElementById("skills").value.trim();
            const resume = document.getElementById("resume").files[0];

            // Check if all fields are filled
            if (!name || !email || !skills || !resume) {
                alert("All fields are required!");
                e.preventDefault(); // Prevent form submission
                return;
            }

            // Validate name
            if (!/^[a-zA-Z\s]+$/.test(name)) {
                alert("Please enter a valid name (letters and spaces only)!");
                e.preventDefault();
                return;
            }

            // Validate email format
            if (!validateEmail(email)) {
                alert("Please enter a valid email address!");
                e.preventDefault();
                return;
            }

            // Validate skills (must be comma-separated)
            if (!validateSkills(skills)) {
                alert(
                    "Please enter skills as a comma-separated list (e.g., JavaScript, HTML, CSS)!"
                );
                e.preventDefault();
                return;
            }

            // Validate resume file type
            const allowedExtensions = ["pdf", "docx", "doc"];
            const fileExtension = resume.name.split(".").pop().toLowerCase();
            if (!allowedExtensions.includes(fileExtension)) {
                alert("Invalid file type! Please upload a PDF, DOCX, or DOC file.");
                e.preventDefault();
                return;
            }
        });
    }

    // Helper function to validate email
    function validateEmail(email) {
        const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email);
    }

    // Helper function to validate skills input
    function validateSkills(skills) {
        const skillsArray = skills.split(",").map((skill) => skill.trim());
        return skillsArray.length > 0 && skillsArray.every((skill) => /^[a-zA-Z\s]+$/.test(skill));
    }
});
document.getElementById("searchForm").addEventListener("submit", async (e) => {
    e.preventDefault(); // Prevent form submission from reloading the page

    const searchTerm = document.querySelector("input[name='searchTerm']").value;
    const resultDiv = document.getElementById("result");

    try {
        const response = await fetch("/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ searchTerm }),
        });

        if (response.ok) {
            const data = await response.json();
            if (typeof data === "string") {
                resultDiv.innerHTML = `<p>${data}</p>`;
            } else {
                resultDiv.innerHTML = `
                    <p>Candidate found in Excel:</p>
                    <pre>${JSON.stringify(data.excelRow, null, 2)}</pre>
                `;
            }
        } else {
            resultDiv.innerHTML = `<p>No matching candidate found.</p>`;
        }
    } catch (error) {
        console.error("Error:", error);
        resultDiv.innerHTML = `<p>An error occurred. Please try again later.</p>`;
    }
});
