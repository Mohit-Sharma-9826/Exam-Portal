// ==========================================
// EXAM INTERFACE CONTROLLER
// ==========================================

let activeIndex = 1;
let totalQuestions = 0;
let remainingSeconds = 0;
let examId = '';
let timerInterval = null;

document.addEventListener('DOMContentLoaded', () => {
  // Read setup data from EJS variables passed through data-attributes
  const meta = document.getElementById('exam-meta');
  if (!meta) return;

  examId = meta.dataset.examId;
  totalQuestions = parseInt(meta.dataset.totalQuestions, 10);
  remainingSeconds = parseInt(meta.dataset.remainingSeconds, 10);

  // Initialize view
  jumpToQuestion(1);
  syncPaletteCounters();

  // Initialize and start countdown timer
  startTimer();
});

// ==========================================
// COUNTDOWN TIMER LOGIC
// ==========================================
function startTimer() {
  const timerDisplay = document.getElementById('countdown-timer');
  const timerBox = document.getElementById('timer-box');

  const updateDisplay = () => {
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      timerDisplay.innerText = "00:00:00";
      autoSubmitExam();
      return;
    }

    // Flash timer red if less than 60 seconds remain
    if (remainingSeconds <= 60) {
      timerBox.classList.add('timer-flash-danger');
    }

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    const pad = (num) => String(num).padStart(2, '0');
    timerDisplay.innerText = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    remainingSeconds--;
  };

  updateDisplay();
  timerInterval = setInterval(updateDisplay, 1000);
}

// ==========================================
// NAVIGATION LOGIC
// ==========================================
function jumpToQuestion(index) {
  if (index < 1 || index > totalQuestions) return;

  // Toggle active card
  document.querySelectorAll('.question-card').forEach(card => {
    card.style.display = 'none';
  });

  const activeCard = document.getElementById(`q-card-${index}`);
  if (activeCard) {
    activeCard.style.display = 'block';
  }

  // Toggle active palette button outline
  document.querySelectorAll('.palette-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const paletteBtn = document.getElementById(`palette-btn-${index}`);
  if (paletteBtn) {
    paletteBtn.classList.add('active');
    
    // Mark as visited (red) if currently unvisited (grey)
    if (paletteBtn.classList.contains('grey')) {
      paletteBtn.classList.remove('grey');
      paletteBtn.classList.add('red');
      saveAnswerState(activeCard.dataset.questionId, { visited: true });
    }
  }

  activeIndex = index;

  // Sync navigation footer buttons disabled states
  document.getElementById('prev-btn').disabled = (activeIndex === 1);
  const nextBtn = document.getElementById('next-btn');
  if (activeIndex === totalQuestions) {
    nextBtn.innerHTML = 'Save & Review <i class="fa-solid fa-bookmark"></i>';
  } else {
    nextBtn.innerHTML = 'Save & Next <i class="fa-solid fa-arrow-right"></i>';
  }

  syncPaletteCounters();
}

function navigateQuestion(direction) {
  const nextIndex = activeIndex + direction;
  jumpToQuestion(nextIndex);
}

// ==========================================
// OPTIONS SELECTION & SAVING
// ==========================================
function selectOption(index, optionVal) {
  const card = document.getElementById(`q-card-${index}`);
  const qId = card.dataset.questionId;

  // Update visual selection styles in options cards
  const optionsList = card.querySelectorAll('.option-item');
  optionsList.forEach(opt => {
    opt.classList.remove('selected');
    const input = opt.querySelector('input');
    if (input && input.value === optionVal) {
      opt.classList.add('selected');
      input.checked = true;
    }
  });

  // Color palette button green (answered)
  const paletteBtn = document.getElementById(`palette-btn-${index}`);
  if (paletteBtn) {
    paletteBtn.className = 'palette-btn green active';
  }

  saveAnswerState(qId, { selectedOption: optionVal });
}

function clearSelectedOption() {
  const card = document.getElementById(`q-card-${activeIndex}`);
  const qId = card.dataset.questionId;

  // Uncheck all radio inputs
  const optionsList = card.querySelectorAll('.option-item');
  optionsList.forEach(opt => {
    opt.classList.remove('selected');
    const input = opt.querySelector('input');
    if (input) input.checked = false;
  });

  // Color palette button red (unanswered since cleared)
  const paletteBtn = document.getElementById(`palette-btn-${activeIndex}`);
  if (paletteBtn) {
    paletteBtn.className = 'palette-btn red active';
  }

  saveAnswerState(qId, { selectedOption: '' });
}

function markForReview() {
  const card = document.getElementById(`q-card-${activeIndex}`);
  const qId = card.dataset.questionId;
  const paletteBtn = document.getElementById(`palette-btn-${activeIndex}`);

  if (!paletteBtn) return;

  // Toggle marked class state
  const isMarked = !paletteBtn.classList.contains('purple');
  
  if (isMarked) {
    paletteBtn.className = 'palette-btn purple active';
  } else {
    // Revert back to answered (green) or unanswered (red)
    const cardSelected = card.querySelector('.option-item.selected');
    if (cardSelected) {
      paletteBtn.className = 'palette-btn green active';
    } else {
      paletteBtn.className = 'palette-btn red active';
    }
  }

  saveAnswerState(qId, { markedForReview: isMarked });
}

// ==========================================
// PERSISTENCE (AJAX REST SERVICE)
// ==========================================
async function saveAnswerState(questionId, payload) {
  try {
    const response = await fetch('/api/student/save-answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        examId,
        questionId,
        ...payload
      })
    });
    
    const data = await response.json();
    if (!data.success) {
      console.warn('Sync failed:', data.message);
    }
  } catch (error) {
    console.error('Network sync error:', error);
  }
}

// ==========================================
// PALETTE STATISTICS
// ==========================================
function syncPaletteCounters() {
  let answered = 0;
  let unanswered = 0;
  let marked = 0;
  let unvisited = 0;

  document.querySelectorAll('.palette-btn').forEach(btn => {
    if (btn.classList.contains('green')) answered++;
    else if (btn.classList.contains('red')) unanswered++;
    else if (btn.classList.contains('purple')) marked++;
    else if (btn.classList.contains('grey')) unvisited++;
  });

  // Update DOM widgets
  const ansEl = document.getElementById('count-answered');
  const unansEl = document.getElementById('count-unanswered');
  const markEl = document.getElementById('count-marked');
  const unvisEl = document.getElementById('count-unvisited');

  if (ansEl) ansEl.innerText = answered;
  if (unansEl) unansEl.innerText = unanswered;
  if (markEl) markEl.innerText = marked;
  if (unvisEl) unvisEl.innerText = unvisited;

  // Sync values into the confirm modal
  const modalAnswered = document.getElementById('modal-answered-val');
  const modalMarked = document.getElementById('modal-marked-val');
  
  if (modalAnswered) modalAnswered.innerText = answered;
  if (modalMarked) modalMarked.innerText = marked;
}

// ==========================================
// SUBMISSIONS (CONFIRMATION MODAL & AUTOMATIC SUBMIT)
// ==========================================
function triggerSubmitConfirmation() {
  const modal = document.getElementById('confirm-modal');
  if (modal) {
    syncPaletteCounters();
    modal.style.display = 'flex';
  }
}

function closeSubmitConfirmation() {
  const modal = document.getElementById('confirm-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function autoSubmitExam() {
  console.log("Timer ended. Auto submitting exam...");
  alert("Time is up! Your exam will be submitted automatically.");
  
  // Submit the form programmatically
  const form = document.getElementById('submit-form');
  if (form) {
    form.submit();
  }
}
