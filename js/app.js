// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
const authSection = document.getElementById('auth-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

let calendarMonth = (new Date()).getMonth();
let calendarYear = (new Date()).getFullYear();
let currentUser = null;
let isAdmin = false;
let isGuest = false;

const guestBtn = document.getElementById('guest-btn');

// Initialize Firebase
let db;
let isFirebaseConfigured = false;

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyC71A7tOfdiydhtjOxVUzBEHDUtI1Ky33M",
    authDomain: "tvb-rickshaw.firebaseapp.com",
    projectId: "tvb-rickshaw",
    storageBucket: "tvb-rickshaw.firebasestorage.app",
    messagingSenderId: "633278327629",
    appId: "1:633278327629:web:a281cf4c907739d135e504",
    measurementId: "G-BN3EQPZSYL"
};
try {
    if (firebaseConfig.apiKey !== "dummy") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        isFirebaseConfigured = true;
        document.getElementById('firebase-config-alert').style.display = 'none';
    }
} catch (error) {
    console.error("Firebase initialization error:", error);
}

// Auth state
firebase.auth().onAuthStateChanged(async user => {
    currentUser = user;
    isAdmin = false;
    isGuest = false;
    if (user) {
        // Check admin role
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            isAdmin = userDoc.exists && userDoc.data().role === 'admin';
        } catch (err) {
            console.error('Error fetching user role:', err);
        }
        authSection.style.display = 'none';
        document.querySelector('.container').style.display = '';
        loadBookings();
    } else if (localStorage.getItem('isGuest') === 'true') {
        isGuest = true;
        authSection.style.display = 'none';
        document.querySelector('.container').style.display = '';
        loadBookings();
    } else {
        authSection.style.display = '';
        document.querySelector('.container').style.display = 'none';
    }
});

// Guest button handler
guestBtn.addEventListener('click', () => {
    isGuest = true;
    localStorage.setItem('isGuest', 'true');
    authSection.style.display = 'none';
    document.querySelector('.container').style.display = '';
    loadBookings();
});

// Logout handler (works for both admin and guest)
logoutBtn.addEventListener('click', async () => {
    if (isGuest) {
        isGuest = false;
        localStorage.removeItem('isGuest');
        authSection.style.display = '';
        document.querySelector('.container').style.display = 'none';
    } else {
        await firebase.auth().signOut();
    }
});

// Show/hide UI based on auth state
firebase.auth().onAuthStateChanged(user => {
    currentUser = user;
    isAdmin = user && adminEmails.includes(user.email);

    if (user) {
        authSection.style.display = 'none';
        document.querySelector('.container').style.display = '';
        loadBookings();
    } else {
        authSection.style.display = '';
        document.querySelector('.container').style.display = 'none';
    }
});

// Login form handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
        loginForm.reset();
    } catch (err) {
        alert('Login failed: ' + err.message);
    }
});

// Logout handler
logoutBtn.addEventListener('click', async () => {
    await firebase.auth().signOut();
});

// Show logout button when logged in
firebase.auth().onAuthStateChanged(user => {
    logoutBtn.style.display = user ? '' : 'none';
});

// App state
const currentDate = new Date();
let selectedDate = null;
let selectedTimeSlot = null;
let bookings = [];

// Time slots (2-hour minimum blocks)
const timeSlots = [
    '08:00-10:00',
    '10:00-12:00',
    '12:00-14:00',
    '14:00-16:00',
    '16:00-18:00',
    '18:00-20:00'
];

// Firebase database functions
async function loadBookings() {
    if (!isFirebaseConfigured) {
        // Fallback to sample data for demo
        bookings = [
            {
                id: 'demo1',
                date: '2025-06-28',
                time: '09:00-12:00',
                name: 'Max Müller',
                email: 'max@example.com',
                phone: '+49 123 456789',
                notes: 'City tour with family'
            },
            {
                id: 'demo2',
                date: '2025-06-29',
                time: '14:00-17:00',
                name: 'Anna Schmidt',
                email: 'anna@example.com',
                phone: '+49 987 654321',
                notes: 'Exploring the old town'
            }
        ];
        displayBookings();
        generateCalendar();
        return;
    }

    try {
        const snapshot = await db.collection('bookings').orderBy('date', 'asc').get();
        bookings = [];
        snapshot.forEach(doc => {
            bookings.push({ id: doc.id, ...doc.data() });
        });
        displayBookings();
        generateCalendar();
    } catch (error) {
        console.error("Error loading bookings:", error);
        showAlert('Error loading bookings. Please refresh the page.', 'error');
    }
}

// In addBooking, restrict guests to one booking
async function addBooking(bookingData) {
    if (!isFirebaseConfigured) {
        // ...existing fallback...
        return newBooking;
    }

    // Restrict guest to one booking per email (or per session)
    if (isGuest) {
        // Check if guest already booked (by email or localStorage)
        const guestEmail = bookingData.email;
        const snapshot = await db.collection('bookings').where('email', '==', guestEmail).get();
        if (!snapshot.empty) {
            throw new Error('Guests can only make one booking.');
        }
    }

    try {
        const docRef = await db.collection('bookings').add(bookingData);
        const newBooking = { id: docRef.id, ...bookingData };
        bookings.push(newBooking);
        displayBookings();
        generateCalendar();
        return newBooking;
    } catch (error) {
        console.error("Error adding booking:", error);
        throw new Error('Failed to save booking. Please try again.');
    }
}

async function deleteBooking(bookingId) {
    if (!isFirebaseConfigured) {
        // Fallback to local array for demo
        bookings = bookings.filter(b => b.id !== bookingId);
        displayBookings();
        generateCalendar();
        return;
    }

    try {
        await db.collection('bookings').doc(bookingId).delete();
        bookings = bookings.filter(b => b.id !== bookingId);
        displayBookings();
        generateCalendar();
        showAlert('Booking deleted successfully!');
    } catch (error) {
        console.error("Error deleting booking:", error);
        showAlert('Error deleting booking. Please try again.', 'error');
    }
}

function generateCalendar() {
    const calendar = document.getElementById('calendar');
    const today = new Date();
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);

    // Calculate first day of week (Monday = 0)
    const startDate = new Date(firstDay);
    const dayOfWeek = (firstDay.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
    startDate.setDate(startDate.getDate() - dayOfWeek);

    calendar.innerHTML = '';

    for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        const dayElement = document.createElement('div');
        dayElement.className = 'day';
        dayElement.textContent = date.getDate();

        const dateStr = date.toISOString().split('T')[0];
        const isCurrentMonth = date.getMonth() === calendarMonth && date.getFullYear() === calendarYear;
        const isToday = dateStr === today.toISOString().split('T')[0];
        const hasBooking = bookings.some(b => b.date === dateStr);
        const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());

        if (isCurrentMonth) {
            dayElement.classList.add('current-month');
        } else {
            dayElement.classList.add('other-month');
        }

        if (isToday) {
            dayElement.classList.add('today');
        }

        if (hasBooking) {
            dayElement.classList.add('has-booking');
        }

        if (!isPast && isCurrentMonth) {
            dayElement.addEventListener('click', () => selectDate(dateStr, dayElement));
        } else if (isPast) {
            dayElement.style.opacity = '0.5';
            dayElement.style.cursor = 'not-allowed';
        }

        calendar.appendChild(dayElement);
    }

    // Update month label
    document.getElementById('calendar-month-label').textContent =
        `${firstDay.toLocaleString('default', { month: 'long' })} ${calendarYear}`;
}

function prevMonth() {
    if (calendarMonth === 0) {
        calendarMonth = 11;
        calendarYear--;
    } else {
        calendarMonth--;
    }
    generateCalendar();
}

function nextMonth() {
    if (calendarMonth === 11) {
        calendarMonth = 0;
        calendarYear++;
    } else {
        calendarMonth++;
    }
    generateCalendar();
}

function selectDate(dateStr, element) {
    // Remove previous selection
    document.querySelectorAll('.day.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // Add selection to clicked element
    element.classList.add('selected');
    selectedDate = dateStr;

    // Update form
    const date = new Date(dateStr);
    document.getElementById('selected-date').value = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    updateTimeSlots(dateStr);
    validateForm();
}

function updateTimeSlots(dateStr) {
    const timeSlotsContainer = document.getElementById('time-slots');
    timeSlotsContainer.innerHTML = '';

    timeSlots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = 'time-slot';
        slotElement.textContent = slot;

        const isBooked = bookings.some(b => b.date === dateStr && b.time === slot);

        if (isBooked) {
            slotElement.classList.add('booked');
            slotElement.textContent += ' (Booked)';
        } else {
            slotElement.addEventListener('click', () => selectTimeSlot(slot, slotElement));
        }

        timeSlotsContainer.appendChild(slotElement);
    });
}

function selectTimeSlot(slot, element) {
    // Remove previous selection
    document.querySelectorAll('.time-slot.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // Add selection to clicked element
    element.classList.add('selected');
    selectedTimeSlot = slot;
    validateForm();
}

function validateForm() {
    const submitBtn = document.getElementById('submit-btn');
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;

    const isValid = selectedDate && selectedTimeSlot && name && email && phone;
    submitBtn.disabled = !isValid;
}

function displayBookings() {
    const container = document.getElementById('bookings-container');

    if (bookings.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096;">No bookings yet. Be the first to book!</p>';
        return;
    }

    // Sort bookings by date
    const sortedBookings = [...bookings].sort((a, b) => new Date(a.date) - new Date(b.date));

    container.innerHTML = sortedBookings.map(booking => {
        const date = new Date(booking.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Only show delete button for admins
        const deleteBtn = isAdmin
            ? `<button class="delete-btn" onclick="deleteBooking('${booking.id}')" title="Delete booking">×</button>`
            : '';

        return `
                    <div class="booking-item">
                        ${deleteBtn}
                        <div class="booking-date">${formattedDate}</div>
                        <div class="booking-time">${booking.time}</div>
                        <div class="booking-name">👤 ${booking.name}</div>
                        <div class="booking-contact">📧 ${booking.email} | 📞 ${booking.phone}</div>
                        ${booking.notes ? `<div class="booking-contact">📝 ${booking.notes}</div>` : ''}
                    </div>
                `;
    }).join('');
}

function showAlert(message, type = 'success') {
    const alert = document.getElementById('booking-alert');
    alert.textContent = message;
    alert.style.display = 'block';
    alert.style.background = type === 'success' ? '#e6fffa' : '#fed7d7';
    alert.style.borderColor = type === 'success' ? '#38b2ac' : '#f56565';
    alert.style.color = type === 'success' ? '#234e52' : '#c53030';

    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

// Form submission
document.getElementById('bookingForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Booking...';
    submitBtn.disabled = true;

    try {
        const bookingData = {
            date: selectedDate,
            time: selectedTimeSlot,
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            notes: document.getElementById('notes').value,
            createdAt: new Date().toISOString()
        };

        await addBooking(bookingData);

        // Reset form
        this.reset();
        selectedDate = null;
        selectedTimeSlot = null;
        document.getElementById('selected-date').value = '';
        document.getElementById('time-slots').innerHTML = '';
        document.querySelectorAll('.day.selected').forEach(el => {
            el.classList.remove('selected');
        });

        showAlert('🎉 Booking confirmed! We look forward to your rickshaw adventure!');

    } catch (error) {
        showAlert(error.message, 'error');
    } finally {
        submitBtn.textContent = originalText;
        validateForm();
    }
});

// Form validation on input
['name', 'email', 'phone'].forEach(id => {
    document.getElementById(id).addEventListener('input', validateForm);
});

// Initialize app
document.addEventListener('DOMContentLoaded', function () {
    loadBookings();
    document.getElementById('calendar-prev').addEventListener('click', prevMonth);
    document.getElementById('calendar-next').addEventListener('click', nextMonth);
});
