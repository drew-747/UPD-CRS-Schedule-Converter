function extractSchedule() {
    const scheduleTable = document.querySelector('table.table-bordered');
    const schedule = [];

    if (scheduleTable) {
        const rows = scheduleTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                const classInfo = cells[6].textContent.trim().split('\n');
                schedule.push({
                    time: cells[0].textContent.trim(),
                    mon: cells[1].textContent.trim(),
                    tue: cells[2].textContent.trim(),
                    wed: cells[3].textContent.trim(),
                    thu: cells[4].textContent.trim(),
                    fri: cells[5].textContent.trim(),
                    sat: cells[6].textContent.trim(),
                    classCode: classInfo[0].trim(),
                    className: classInfo[1].trim(),
                    instructor: classInfo[2].trim(),
                    room: classInfo[3].trim()
                });
            }
        });
    }

    return schedule;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSchedule') {
        sendResponse({ schedule: extractSchedule() });
    }
});
