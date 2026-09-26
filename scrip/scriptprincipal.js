const checkbox = document.getElementById('cyber-toggle');
if (checkbox) {
  checkbox.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode');
  });
}
if (passInput && btnEye) {
  passInput.addEventListener('input', () => {
    if (passInput.value.length > 0) {
      btnEye.style.display = 'flex'; 
    } else {
      btnEye.style.display = 'none'; 
    }
  });
  btnEye.addEventListener('click', () => {
    const eyeOpenIcon = btnEye.querySelector('.eye-open');
    const eyeClosedIcon = btnEye.querySelector('.eye-closed');

    if (passInput.type === 'password') {
      passInput.type = 'text';
      eyeOpenIcon.style.display = 'none';
      eyeClosedIcon.style.display = 'block';
    } else {
      passInput.type = 'password';
      eyeOpenIcon.style.display = 'block';
      eyeClosedIcon.style.display = 'none';
    }
  });
}