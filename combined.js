document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const convertICSButton = document.getElementById('convertICS');
    const convertCSVButton = document.getElementById('convertCSV');
    const convertJSONButton = document.getElementById('convertJSON');

    function setStatus(message) {
        statusElement.textContent = message;
    }

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

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], {type: mimeType});
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true
        });
    }

    function convertToICS(schedule) {
        let icsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//UPD CRS Schedule Converter//EN\n';
        schedule.forEach(item => {
            const days = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
            const [startTime, endTime] = item.time.split(' to ');
            days.forEach((day, index) => {
                if (item[Object.keys(item)[index + 1]]) {
                    icsContent += `BEGIN:VEVENT\n`;
                    icsContent += `SUMMARY:${item.className}\n`;
                    icsContent += `LOCATION:${item.room}\n`;
                    icsContent += `DESCRIPTION:${item.classCode} - ${item.instructor}\n`;
                    icsContent += `RRULE:FREQ=WEEKLY;BYDAY=${day}\n`;
                    icsContent += `DTSTART:20240101T${startTime.replace(':', '')}00\n`;
                    icsContent += `DTEND:20240101T${endTime.replace(':', '')}00\n`;
                    icsContent += `END:VEVENT\n`;
                }
            });
        });
        icsContent += 'END:VCALENDAR';
        return icsContent;
    }

    function convertToCSV(schedule) {
        const headers = ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Class Code', 'Class Name', 'Instructor', 'Room'];
        let csvContent = headers.join(',') + '\n';
        schedule.forEach(item => {
            csvContent += `${item.time},${item.mon},${item.tue},${item.wed},${item.thu},${item.fri},${item.sat},${item.classCode},"${item.className}","${item.instructor}",${item.room}\n`;
        });
        return csvContent;
    }

    function convertToJSON(schedule) {
        return JSON.stringify(schedule, null, 2);
    }

    convertICSButton.addEventListener('click', () => {
        setStatus('Converting to ICalendar...');
        const schedule = extractSchedule();
        const icsContent = convertToICS(schedule);
        downloadFile(icsContent, 'upd_schedule.ics', 'text/calendar');
        setStatus('ICalendar file downloaded!');
    });

    convertCSVButton.addEventListener('click', () => {
        setStatus('Converting to CSV...');
        const schedule = extractSchedule();
        const csvContent = convertToCSV(schedule);
        downloadFile(csvContent, 'upd_schedule.csv', 'text/csv');
        setStatus('CSV file downloaded!');
    });

    convertJSONButton.addEventListener('click', () => {
        setStatus('Converting to JSON...');
        const schedule = extractSchedule();
        const jsonContent = convertToJSON(schedule);
        downloadFile(jsonContent, 'upd_schedule.json', 'application/json');
        setStatus('JSON file downloaded!');
    });
});
