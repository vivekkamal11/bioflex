// data.json file se data fetch kar rahe hain
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        const profileCard = document.getElementById('profile-card');

        // 1. Profile Section Banate hain
        let htmlContent = `
            <img src="${data.avatar}" alt="Profile" class="w-24 h-24 rounded-full mx-auto mb-4 border-2 border-indigo-500 p-1 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
            <h2 class="text-2xl font-bold text-white mb-1">${data.fullName}</h2>
            <p class="text-indigo-400 text-sm font-semibold mb-3">${data.username}</p>
            <p class="text-slate-300 text-sm mb-8 px-2">${data.bio}</p>
            <div class="space-y-4">
        `;

        // 2. JSON me jitne bhi links hain, unke liye buttons banate hain
        data.links.forEach(link => {
            htmlContent += `
                <a href="${link.url}" target="_blank" class="flex items-center p-4 bg-slate-800/50 hover:bg-indigo-600 transition-all duration-300 rounded-2xl border border-slate-700 hover:border-indigo-400 group shadow-lg">
                    <div class="w-10 h-10 flex justify-center items-center rounded-full bg-slate-900 group-hover:bg-indigo-700 transition-colors">
                        <i class="${link.icon} text-xl text-indigo-400 group-hover:text-white transition-colors"></i>
                    </div>
                    <span class="font-semibold text-slate-200 group-hover:text-white transition-colors ml-4">${link.title}</span>
                </a>
            `;
        });

        // HTML ko band karke page me dal do
        htmlContent += `</div>`;
        profileCard.innerHTML = htmlContent;
    })
    .catch(error => {
        console.error('Error loading data:', error);
        document.getElementById('profile-card').innerHTML = '<p class="text-red-500">Data load nahi hua. VS Code me Live Server use karo.</p>';
    });