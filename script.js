// Basic client-side JavaScript for form validation and dynamic behavior

// Add event listeners for forms
document.addEventListener("DOMContentLoaded", () => {
    // Example: Validate Add Resume form before submission
    const addResumeForm = document.querySelector("form[action='/add-resume']");
    if (addResumeForm) {
        addResumeForm.addEventListener("submit", (e) => {
            const name = document.querySelector("input[name='name']").value.trim();
            const email = document.querySelector("input[name='email']").value.trim();
            const phone = document.querySelector("input[name='phone']").value.trim();
            const skills = document.querySelector("textarea[name='skills']").value.trim();

            if (!name || !email || !phone || !skills) {
                alert("Please fill out all fields!");
                e.preventDefault(); // Prevent form submission
            } else if (!validateEmail(email)) {
                alert("Please enter a valid email address!");
                e.preventDefault(); // Prevent form submission
            }
        });
    }

    // Example: Add functionality for search resume page
    const searchResumeForm = document.querySelector("form[action='/search-resume']");
    if (searchResumeForm) {
        searchResumeForm.addEventListener("submit", (e) => {
            const name = document.querySelector("input[name='name']").value.trim();
            if (!name) {
                alert("Please enter a name to search!");
                e.preventDefault(); // Prevent form submission
            }
        });
    }
});

// Helper function to validate email
function validateEmail(email) {
    const re = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
}
