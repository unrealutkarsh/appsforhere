function renderTaxNav() {
    $('#taxRateRepeater li.taxRate').remove();
    var list = $('#taxRateRepeater');
    for (var i = model.taxRates.length - 1; i >= 0; i--) {
        var rate = model.taxRates[i];
        var li = $('<li></li>');
        li.addClass('taxRate').prependTo(list);
        $('<a href="#"></a>').text(rate.nameWithRate)
            .appendTo(li).data('tax_data', rate)
            .on('click', function () {
                $('#taxName').val(rate.name);
                $('#taxRate').val(new BigNumber(rate.rate).times(100).toString());
                $('#taxDefault').prop('checked', rate.default);
                selectedTax = rate;
                $('#taxModal').modal();
            });
    }
}

function saveTaxToLocalModel() {
    if (!selectedTax) {
        selectedTax = {};
        model.taxRates.push(selectedTax);
    }
    selectedTax.name = $('#taxName').val();
    selectedTax.rate = new BigNumber($('#taxRate').val()).dividedBy(100).toString();
    selectedTax.default = $('#taxDefault').is(':checked');
    selectedTax.nameWithRate = selectedTax.name + " (" + new BigNumber(selectedTax.rate).times(100).toString() + "%)";
    for (var i = 0; i < model.taxRates.length; i++) {
        var tr = model.taxRates[i];
        if (tr == selectedTax) {
            continue;
        }
        if (selectedTax.default && tr.default) {
            tr.default = false;
        }
    }
    $('#taxModal').modal('hide');
    selectedTax = null;
    renderTaxNav();
}

function addTaxRate() {
    $('#taxName').val("");
    $('#taxRate').val("");
    $('#taxDefault').prop('checked', false);
    $('#taxModal').modal();
    selectedTax = null;
}

function setupTax() {
    $('#taxAdd').on('click', addTaxRate);
    /**
     * Delete a tax rate and remove it from any items to which it is assigned
     */
    $('#deleteTax').on('click', function () {
        var deleted = false;
        if (selectedTax) {
            for (var i = 0; i < model.products.length; i++) {
                if (model.products[i].taxRateName === selectedTax.name) {
                    model.products[i].taxRateName = null;
                    deleted = true;
                }
            }

            model.taxRates.splice($.inArray(selectedTax, model.taxRates), 1);
            selectedTax = null;
            renderTaxNav();
        }
        if (deleted) {
            $('#productGrid').repeater('render');
        }
        $('#taxModal').modal('hide');
    });
    $taxSelect = $('#itemTax').selectize({
        create: function (rateName) {
            addTaxRate();
            $('#taxName').val(rateName);
            return {
                name: rateName,
                nameWithRate: rateName
            };
        },
        sortField: 'name',
        valueField: 'name',
        labelField: 'nameWithRate',
        openOnFocus: true
    });

    $('#taxForm').bootstrapValidator({
        live: 'enabled',
        feedbackIcons: {
            valid: 'glyphicon glyphicon-ok',
            invalid: 'glyphicon glyphicon-remove',
            validating: 'glyphicon glyphicon-refresh'
        },
        fields: {
            taxName: {
                validators: {
                    notEmpty: {
                        message: 'A name is required.'
                    }
                }
            },
            taxRate: {
                validators: {
                    notEmpty: {
                        message: 'A valid tax rate is required'
                    },
                    numeric: {
                        message: 'A valid tax rate is required'
                    }
                }
            }
        }
    }).on('success.form.bv', function(e) {
        e.preventDefault();
        saveTaxToLocalModel();
    });
}