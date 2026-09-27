define(['Magento_Ui/js/modal/confirm', 'jquery'], function (confirm, $) {
    'use strict';
    return function (config, element) {
        $(element).on('submit', function (event) {
            event.preventDefault();
            confirm({title: 'Delete this record?', content: 'This action cannot be undone.', actions: {
                confirm: function () { element.submit(); }
            }});
        });
        $(element).find('button[type=submit]').prop('disabled', false);
    };
});
