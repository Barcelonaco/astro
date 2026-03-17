/* eslint-disable */
document.addEventListener('DOMContentLoaded', function () {
    var elemDiv = document.createElement('div');
    elemDiv.classList.add('bg_login');
    document.body.appendChild(elemDiv);

    var isRounded = document.getElementById('is_rounded');

    if (isRounded) {
        document.body.classList.add('is_rounded');
    }
});
