/***
 * DEBUGGING CODE
 *
 * **/
render_counts = {}; //keep track of the number of times render gets called
render_objects = []; //keep track of the number of times render gets called

function increment_render_counts(name, v1, v2, v3) {
	if (name in render_counts) {
		render_counts[name]++;
	} else {
		render_counts[name] = 1;
	}
	if (v1) {
		render_objects.push([v1.get('name'), v2, v3]);
		console.log([v1.get('name'), v2, v3]);
	}
}


/**
 * MODELS: Here we are defining all the models in the MVC structure
 * ----------------------------------------------------------------
 * 
 */
var NullInputModel = Backbone.Model.extend({
	defaults: {}
});

//a simple wrapper type of object that always shows the dependent input

//a simple wrapper type of object that always shows the dependent input
var NullFormCondition = Backbone.Model.extend({
	defaults: { "field" : new NullInputModel() } ,
	evaluate: function(model, successfulValidation, unsuccessfulValidation) {
		return true;
	}
});

var FormCondition = Backbone.Model.extend({
	defaults: {
		"field": new NullInputModel(), //a FormInput
		"operator": "==", // '==', '!=', '<', '>', etc.
		"value": null //probably a string
	},
	evaluate: function(model, successfulValidation, unsuccessfulValidation) {
		var sub = this.get('field').get('value');
		var comp = this.get('operator');
		var obj = this.get('value'); 
		var evaluation_string = 'sub ' + comp + ' obj' ;
		var should_be_shown = eval( evaluation_string );
		if (should_be_shown) {
			successfulValidation(model);
		} else {
			unsuccessfulValidation(model);
		}
		return should_be_shown;
	}
});

var HtmlElement = Backbone.Model.extend({
	defaults: {
		"tag": "div",
		"html": "",
		"attributes" : {}
	},
	initialize: function(attributes) {
		var internal_attributes = this.get('attributes');
		for( var key in attributes ) {
			internal_attributes[key] = attributes[key];
		}
		this.set('attributes', internal_attributes);
	},
	renderTo: function(element) {
		var new_node = $('<' + this.get('tag') + '/>', 
							this.get('attributes') );
		new_node.html(this.get('html'));
		$(element).append(new_node);
	}
});

/**
 * form input
 */
var FormInput = Backbone.Model.extend({
	defaults: {
		"id": false,
		"type": 'text',
		"name": '',
		"label": '',
		"value": '',
		"options": {},
		"default_value": '', 
		"view": null,
		"dependencyCondition": null,
		"dependencySatisfiedCallback": null,
		"dependencyNotSatisfiedCallback": null,
		"disabled": false,
		"hidden": false
	},
	initialize: function(attributes) {
		var condition = this.get('dependencyCondition');
		if (condition == null) {
			this.set('dependencyCondition', new NullFormCondition());
		} else {
			this.set('dependencyCondition', new FormCondition(condition));
		}
		if (attributes.id == false) {
			this.set('id', 'FormInputField_' + this.cid);
		}
	},
	attachTo: function(element) {
		this.set('view', new FormInputView({model: this, element: element}));
		this.initializeCallbacks();
		this.isDependencySatisfied();
	},
	render: function(element) {
		this.get('view').render();
	},
	//if callbacks are not explicitly set for dependencies, use some reasonable defaults
	initializeCallbacks: function() {
		this.get('dependencyCondition').get('field').on('change', this.isDependencySatisfied, this);
		if (this.get('dependencySatisfiedCallback') == null) {
			if (this.get('disabled') ) {
				this.set('dependencySatisfiedCallback', this.enable);
			} else {
				this.set('dependencySatisfiedCallback', this.show);
			}
		}
		if (this.get('dependencyNotSatisfiedCallback') == null) {
			if (this.get('disabled') ) {
				this.set('dependencyNotSatisfiedCallback', this.disable);
			} else {
				this.set('dependencyNotSatisfiedCallback', this.hide);
			}
		}
	},
	enable: function (model) {
		model.get('view').unlock();
	},
	disable: function (model) {
		model.get('view').lock();
	},
	show: function (model) {
		model.get('view').show();
	},
	hide: function (model) {
		model.get('view').hide();
	},
	isDependencySatisfied: function() {
		var dependency = this.get('dependencyCondition');
		dependency.evaluate(
			this, 
			this.get('dependencySatisfiedCallback'), 
			this.get('dependencyNotSatisfiedCallback')
		);
	}
});

var FormInputGroup = Backbone.Model.extend({
	defaults: { name: null, input_rows: [] },
	initialize: function() {
		this.set('rendered', false);
	},
	createInputSet: function(inputs) {
		var temp_collection = new FormInputCollection(inputs);
		this.set('input_rows', [] );
		this.get('input_rows').push(temp_collection);
	}, 
	addRow: function(inputs) {
		var last_inserted_collection = this.get('input_rows')[ this.numRows() - 1];
		var new_collection = new FormInputCollection();
		last_inserted_collection.each(function(input) {
			new_collection.add(input.clone());
		});
		this.get('input_rows').push(new_collection);
		this.get('view').attachRow(new_collection);
	},
	attachTo: function(element) {
		this.set('view', new FormInputGroupView({"element" : element, "model" : this}));
		this.get('view').attachElements();
		this.set('rendered', true);
	},
	numRows: function() {
		return this.get('input_rows').length;
	}
});

var FormFieldSet = Backbone.Model.extend({
	defaults: {
		name: null,
		collection: null
		},
	initialize: function(attributes) {
		if (attributes.collection == null) {
			this.set('collection', new FormInputCollection());
		}
	},
	addInput: function(input) {
		var this_handle = this;
		$(input).each( function( index, obj ) {
					if ( 'on' in obj) {
						obj.on('change', this_handle.trigger_change, this_handle);
					}
				} );
		this.get('collection').add(input);
	}, 
	attachTo: function(element) {
		this.view = new FieldSetView({model: this, element: element});
	},
	render: function() {
		this.view.render();
	},
	trigger_change: function(changedObject, changes) {
		this.trigger('inputUpdated', changedObject, changes);
	}
});

var FormInputCollection = Backbone.Collection.extend({ model: FormInput });

var Form = Backbone.Model.extend({
	defaults: {
		action: null,
		name: "",
		method: "post",
		wizard_style: false
	},
	initialize: function(attributes) {
		this.set("fieldset", new FormFieldSet({
					name: this.get("name")
				}));
	},
	addInput: function (input) {
		var this_handle = this;
		$(input).each( function( index, obj ) {
					if ( 'on' in obj) {
						obj.on('inputUpdated', this_handle.trigger_change, this_handle);
					}
				} );
		this.get("fieldset").addInput(input);
		this.trigger('change');
	},
	attachTo: function(element) {
		this.view = new FormView({model: this, element: element});
	},
	render: function() {
		this.view.render();
	},
	getFieldSets: function () {
		return this.get("fieldset").get("collection");
	},
	getFieldSet: function (index) {
		return this.getFieldSets().at(index);
	},
	hideAll: function () {
		this.getFieldSets().each( function(fieldset) { fieldset.set("hidden", true); } );
	},
	showOneFieldset: function (index) {
		this.hideAll();
		this.getFieldSet(index).set("hidden", false);
	},
	trigger_change: function(changedObject, changes) {
		this.trigger('inputUpdated', changedObject, changes);
	}
});

var FormWizard = Backbone.Model.extend({
	defaults: {
		element: null,
		form: null
	},
	initialize: function(attributes) {
		this.set('activeFieldSetIndex', 0);
	},
	attachTo: function(element) {
		this.set('view', new FormWizardView({model: this, element: element}));
		this.render();
		this.activateCurrentFieldSet();
	},
	render: function() {
		this.get('view').render();
	},
	numberOfSteps: function() {
		return this.get('form').getFieldSets().length;
	},
	getActiveFieldSet: function() {
		var index = this.get('activeFieldSetIndex');
		return this.get('form').getFieldSet(index);
	},
	activateCurrentFieldSet: function() {
		var index = this.get('activeFieldSetIndex');
		this.configureButtons();
		this.get('form').showOneFieldset(
			this.get('activeFieldSetIndex')
		);
	},
	configureButtons: function() {
		this.get('view').middleStep();
		this.deactivatePreviousButtonIfFirstStep();
		this.replaceNextButtonWithFinalIfLastStep();
	},
	replaceNextButtonWithFinalIfLastStep: function() {
		if (this.get('activeFieldSetIndex') >= this.numberOfSteps() - 1) {
			this.get('view').finalStep();
		}
	},
	deactivatePreviousButtonIfFirstStep: function() {
		if (this.get('activeFieldSetIndex') == 0) {
			this.get('view').firstStep();
		}
	},
	incrementStep: function(count) {
		if(typeof(count)==='undefined') count = 1;
		this.set('activeFieldSetIndex', this.get('activeFieldSetIndex') + count);
	},
	decrementStep: function() {
		this.incrementStep(-1);
	},
	forward: function() {
		this.incrementStep();
		this.activateCurrentFieldSet();
	},
	previous: function() {
		this.decrementStep();
		this.activateCurrentFieldSet();
	}
});

/**
 * TEMPLATES:
 * ---------------------------
 *
 * */
var templates = { 
			"date":  _.template( 
					'<label for="date_<%=id %>"><%=label %></label><input type="date" value="<%=value%>" name="<%=name %>" id="date_<%=id %>"/> \n' 
					),
			"text":  _.template( 
					'<label for="text_<%=id %>"><%=label %></label><input type="text" value="<%=value%>" name="<%=name %>" id="text_<%=id %>"/> \n' 
					),
			"radio":  function (data) { 
					var buffer = (option_templates["radio"](data['options'], data['value']));
					buffer = '<div class="radio_input" id="container_for_<%=id%>"> \n' + buffer + '</div> \n';
					return (_.template(buffer))(data);
				},
			"select":  function (data) { 
					var buffer = (option_templates["select"](data['options'], data['value']));
					buffer = '<div class="select_input" id="container_for_<%=id%>"><label for="select_<%=id%>"><%=label%></label><select name="<%=name %>" id="select_<%=id %>">\n' + buffer + '</select></div> \n';
					return (_.template(buffer))(data);
				},
			"wizard": function(data) {
					var buffer = '<div id="<%=id%>" class="wizard-form-container"></div><input type="button" class="wizard-previous-button" value="<%=previous_button_text%>"></input><input type="button" class="wizard-forward-button" value="<%=next_button_text%>"></input><input type="button" class="wizard-final-button" value="<%=final_button_text%>"></input>';
					return (_.template(buffer))(data);
				},
			"checkbox":  function(data) {
				var checked_string = '';
				if ('value' in data) {
					if (data['value']) {
						checked_string = ' checked';
					}
				}
				var buffer = '<div class="checkbox_input" id="container_for_<%=id%>"> \n' + 
					'<label for="checkbox_<%=id %>"><input type="checkbox" ' + checked_string + ' value="<%=value%>" name="<%=name %>" id="checkbox_<%=id %>"/><%=label %></label> \n' +
					'</div>\n';
				return (_.template(buffer))(data)
			} 
		};

var option_templates = {
			"select":  function (options, val) {
					var buffer = "";
					var iterator = 0;
					var selected_text = '';
					for( var value in options ) {
						selected_text = '';
						if (value == val) {
							selected_text = ' selected';
						}
						buffer += '<option name="<%=name %>" id="select_<%=id %>_' + iterator + '" value="' + value + '"' + selected_text + '>' + options[value] + '</option> \n'
						iterator++;
					}
					return buffer;
				},
			"radio":  function (options, val) {
					var buffer = "";
					var iterator = 0;
					var selected_text = '';
					for( var value in options ) {
						selected_text = '';
						if (value == val) {
							selected_text = ' checked';
						}
						buffer += '<label for="radio_<%=id %>_' + iterator + '"><input type="radio" value="' + value + '" name="<%=name %>" id="radio_<%=id %>_' + iterator + '"' + selected_text + '/>' + options[value] + '</label> \n'
						iterator++;
					}
					return buffer;
				}  
	}

/**
 * VIEWS:
 * ------------------------------------------------
 */
var FormInputView = Backbone.View.extend({
	model: FormInput,
	tagName: 'div',
	template: null,
	input_selector: 'input',
	initialize: function(attributes) {
		this.model.on('change:value change:hidden change:disabled', this.render, this);
		var model_type = this.model.get('type');
		this.template = templates[model_type];
		$(attributes.element).append(this.el);
		this.$el.addClass("FormInputView");
		this.render();
		this.set_input_selector();
		this.set_input_element();
	},
	set_input_selector: function() {
		var model_type = this.model.get('type');
		if (model_type == 'radio') {
			this.input_selector = 'input[checked=checked]';
		} else if (model_type == 'select') {
			this.input_selector = 'select';
		} else if(model_type == 'checkbox') {
			this.input_selector = 'input';
		} else {
			this.input_selector = 'input';
		}
	},
	set_input_element: function() {
		var selector = this.input_selector;
		this.input_element = this.$el.find(selector)[0];
	},
	$input: function() {
		return $(this.input());
	},
	input: function() {
		return this.input_element;
	},
	render: function(var1, var2, var3) {
		increment_render_counts('FormInputView' , var1 , var2 , var3);
		var markup = this.template(	{
										id: this.model.get('id'),
										value: this.model.get('value'),
										options: this.model.get('options'),
										label: this.model.get('label'),
										name: this.model.get('name')
									});
		this.$el.html(markup);
		this.set_input_element();
		if (this.model.get('hidden')) {
			this.hide();
		} else {
			this.show();
		}
		if (this.model.get('disabled')) {
			this.lock();
		} else {
			this.unlock();
		}
	},
	value: function() {
		if (this.model.get('type') == 'checkbox') {
			return this.$input().is(":checked");
		} else if (this.model.get('type') == 'radio') {
			return $(this.$el.find(this.input_selector)[0]).val();
		}
		return this.$input().val();
	},
	show: function() {
		this.unlock();
		this.$el.show();
	},
	hide: function(callback) {
		this.lock();
		this.$el.hide(0, callback);
	},
	lock: function() {
		this.$input().attr('disabled', 'true');
	},
	unlock: function() {
		this.$input().removeAttr('disabled');
	},
	update_model: function() {
		this.model.off('change:value', this.render, this);
		this.model.set('value', this.value());
		this.model.on('change:value', this.render, this);
	},
	events: {
		"change select" : "update_model",
		"change input" : "update_model",
		"keyup input" : "update_model"
	}
});

var FieldSetView = Backbone.View.extend({
	model: FormFieldSet,
	tagName: 'fieldset',
	initialize: function(attributes) {
		$(attributes.element).append(this.el);
		this.$el.html('<legend>' + this.model.get('name') + '</legend>');
		this.elements_container = $('<div class="fieldset-elements"></div>');
		this.$el.append( this.elements_container );
		this.$el.attr('id', 'fieldset_' + this.model.cid);
		this.attachElements();
		attributes.model.on('change', this.render, this);
	},
	attachElements: function() {
		var render_to = this.elements_container;
		this.model.get('collection').each(function(input) {
			input.attachTo(render_to);
		});
	},
	render: function() {
		increment_render_counts('fieldset_view');
		if (this.model.get('hidden') == true) {
			this.$el.hide();
		} else {
			this.$el.show();
		}
		this.model.get('collection').each(function(input) {
			input.render();
		});
	}
});

var FormInputGroupView = Backbone.View.extend({
	model: FormInputGroup,
	tagName: 'div',
	initialize: function(attributes) {
		this.el = attributes.element;
		this.$el = $(attributes.element);
	},
	attachRow: function(row) {
			var row_element = $('<div class="form-input-group-row" />');
			this.$el.append(row_element);
			row.each(function(input) {
				input.attachTo(row_element);
			});
	},
	attachElements: function() {
		var rows = this.model.get('input_rows') ;
		for (var i in rows ) {
			this.attachRow(rows[i]);
		}
	}
});

var FormView = Backbone.View.extend({
	model: Form,
	tagName: 'form',
	initialize: function(attributes) {
		$(attributes.element).append(this.el);
		this.$el.attr("action", this.model.get("action"));
		this.model.get('fieldset').attachTo(this.el);
		attributes.model.on('change', this.render, this);
	},
	render: function() {
		increment_render_counts('form_view');
		this.model.get('fieldset').render();
	}
});

var FormWizardView = Backbone.View.extend({
	model: FormWizard,
	tagName: 'div',
	initialize: function(attributes) {
		var id = 'wizard_form_' + this.model.cid;
		this.el = attributes.element;
		this.$el = $(this.el);
		this.$el.html( templates.wizard( { "id" : id , 
							"next_button_text" : "Next" ,
							"final_button_text" : "Finish" ,
							"previous_button_text" : "Previous" 
						} ) );
		this.model.get('form').attachTo($('#' + id));
		attributes.model.on('change', this.render, this);
	},
	render: function() {
		increment_render_counts('wizard_view');
		this.model.get('form').render();
	},
	firstStep: function() {
		this.$el.find('.wizard-previous-button').hide();
		this.$el.find('.wizard-forward-button').show();
		this.$el.find('.wizard-final-button').hide();
	},
	middleStep: function() {
		this.$el.find('.wizard-previous-button').show();
		this.$el.find('.wizard-forward-button').show();
		this.$el.find('.wizard-final-button').hide();
	},
	finalStep: function() {
		this.$el.find('.wizard-previous-button').show();
		this.$el.find('.wizard-forward-button').hide();
		this.$el.find('.wizard-final-button').show();
	},
	events: {
		"click .wizard-forward-button" : "forward_click",
		"click .wizard-previous-button" : "previous_click",
	},
	forward_click: function(eventObject ) {
		this.model.forward();
	},
	previous_click: function(eventObject ) {
		this.model.previous();
	}
});

