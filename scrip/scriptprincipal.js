const checkbox = document.getElementById('cyber-toggle');
if (checkbox) {
  checkbox.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
  });
}

