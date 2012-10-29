/**
 * MODELS: Here we are defining all the models in the MVC structure
 * ----------------------------------------------------------------
 * 
 */
var NullInputModel = Backbone.Model.extend({
			defaults: {} 
		});

//a simple wrapper type of object that always shows the dependent input
var NullFormCondition = Backbone.Model.extend({
			defaults: { "field" : new NullInputModel() } ,
			evaluate: function(model, successfulValidation, unsuccessfulValidation) {
				return true;
			}
		});

var FormCondition = Backbone.Model.extend({
	defaults: {
		"field": new NullInputModel(),    //a FormInput
		"operator": "==", // '==', '!=', '<', '>', etc.
		"value": null     //probably a string
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

/**
 * form input
 */
var FormInput = Backbone.Model.extend({
	defaults: {
		"id": false,
		"long_label": false,
		"type": 'text',
		"name": '',
		"label": '',
		"form": null,
		"fieldset": null,
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
	},
	renderTo: function(element) {
		this.set('view', new input_view({model: this, element: element}));
		this.get('dependencyCondition').get('field').on('change', this.isDependencySatisfied, this);
		this.initializeCallbacks();
		this.isDependencySatisfied();
	},
	//if callbacks are not explicitly set for dependencies, use some reasonable defaults
	initializeCallbacks: function() {
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

/**
 * TEMPLATES:
 * ---------------------------
 *
 * */
var templates = { 
			"text":  _.template('<div class="text_input" id="container_for_<%=id%>"> \n' + 
					'<label for="<%=id %>"><%=name %><input type="text" value="<%=value%>" name="<%=name %>" id="text_<%=id %>"/></label> \n' +
				'</div>\n'),
			"radio":  function (data) { 
					var buffer = (option_templates["radio"](data['options']));
					buffer = '<div class="text_input" id="container_for_<%=id%>"> \n' + buffer + '</div> \n';
					return (_.template(buffer))(data);
				},
			"checkbox":  _.template('<div class="checkbox_input" id="container_for_<%=id%>"> \n' + 
					'<input type="checkbox" value="<%=value%>" name="<%=name %>" id="text_<%=id %>"/><label for="<%=id %>"><%=name %></label> \n' +
				'</div>\n') 
		};

var option_templates = {
			"radio":  function (options) {
					var buffer = "";
					var iterator = 0;
					for( var value in options ) {
						buffer += '<input type="radio" value="' + value + '" name="<%=name %>" id="text_<%=id %>_' + iterator + '"/><label for="text_<%=id %>_' + iterator + '">' + options[value] + '</label> \n'
						iterator++;
					}
					return buffer;
				}  
	}

/**
 * VIEWS:
 * ------------------------------------------------
 */
    var input_view = Backbone.View.extend({
        model: FormInput,
        tagName: 'div',
        template: null,
        initialize: function(attributes) {
          this.model.on('change', this.render, this);

	  var model_type = this.model.get('type');
	  this.template = templates[model_type];

          $(attributes.element).append(this.el);
          this.render();  
        },
        render: function() {
            var markup = this.template({
                                        id: this.model.get('id'),
                                        value: this.model.get('value'),
                                        options: this.model.get('options'),
                                        name: this.model.get('name')
                                    });
	    this.$el.html(markup);
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
	$input: function() {
		return $(this.input());
	},
	input: function() {
		return this.$el.find('input')[0];
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
		this.model.off('change', this.render, this);
		this.model.set('value', this.$el.find('input').first().val());
		this.model.on('change', this.render, this);
	},
	events: {
		"change input" : "update_model",
		"keyup input" : "update_model"
	}
    });
