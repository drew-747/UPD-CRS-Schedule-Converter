document.addEventListener('DOMContentLoaded', function() {
    const statusElement = document.getElementById('status');
    const convertICSButton = document.getElementById('convertICS');
    const convertCSVButton = document.getElementById('convertCSV');
    const convertJSONButton = document.getElementById('convertJSON');

    function setStatus(message) {
        statusElement.textContent = message;
    }

    function getSchedule() {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: "getSchedule"}, function(response) {
                    if (response && response.schedule) {
                        resolve(response.schedule);
                    } else {
                        reject('Failed to get schedule');
                    }
                });
            });
        });
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

    convertICSButton.addEventListener('click', () => {
        setStatus('Converting to ICalendar...');
        getSchedule()
            .then(schedule => {
                const icsContent = convertToICS(schedule);
                downloadFile(icsContent, 'upd_schedule.ics', 'text/calendar');
                setStatus('ICalendar file downloaded!');
            })
            .catch(error => setStatus(error));
    });

    convertCSVButton.addEventListener('click', () => {
        setStatus('Converting to CSV...');
        getSchedule()
            .then(schedule => {
                const csvContent = convertToCSV(schedule);
                downloadFile(csvContent, 'upd_schedule.csv', 'text/csv');
                setStatus('CSV file downloaded!');
            })
            .catch(error => setStatus(error));
    });

    convertJSONButton.addEventListener('click', () => {
        setStatus('Converting to JSON...');
        getSchedule()
            .then(schedule => {
                const jsonContent = JSON.stringify(schedule, null, 2);
                downloadFile(jsonContent, 'upd_schedule.json', 'application/json');
                setStatus('JSON file downloaded!');
            })
            .catch(error => setStatus(error));
    });
});
