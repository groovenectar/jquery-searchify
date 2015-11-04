;(function ($, window, document, undefined) {
	"use strict";

	var defaults = {
		label: 'Search:', // Inserted before input, null to bypass
		min_chars: 3, // Must have typed at least this many characters to initiate search
		typing_threshold: 350, // Delay in milliseconds to determine whether user is finished typing
		search_location: 'before', // Possible values are "before,after,both,[jQuery Object]"
		active_class: 'searchify', // Applied to element when plugin is activated
		match_class: 'searchify-match', // Matched items gets this class
		no_matches_class: 'searchify-no-results', // Applied to element when there are no results
		form_class: 'searchify-form', // Class name of the search container
		label_template: '<label>', // HTML or jQuery object. Any special attributes/classes can be added
		input_template: '<input type="search">', // HTML or jQuery object. Any special attributes/classes can be added
		wrap_label: true, // If false, give the input template an "id" attribute and label template a "for" attribute
		item_filter: '*', // .filter() to run on items to determine what is included (E.g. ":visible")
		form_input: null, // String selector or jQuery object. If specified, will only use existing input for search
		match_method: 'css', // Values: css | dom ; "remove" deletes the elements from the DOM
		item_text: function() { // Return item text to match against. "this" context is the item element
			return this.text();
		},
		rendered: function() { }, // Called after plugin finishes rendering. "this" context is the plugin instance
		search_init: function(search_terms) { // Called before search logic begins. "this" context is the plugin instance
			this.no_results_alert && this.no_results_alert.remove();
		},
		matches: function(matches, search_terms) { }, // Called when there are search results. "this" context is the plugin instance
		no_matches: function(search_terms) { // Called when there are no search results. "this" context is the plugin instance
			this.no_results_alert = $('<div>').addClass(this.options.no_matches_class).text('No results for "' + search_terms + '"')
			this.element.before(this.no_results_alert);
		},
		search_complete: function() { }, // Called when searching is complete. "this" context is the plugin instance
		destroyed: function() { // Called after plugin is destroyed. "this" context is the plugin instance
			this.no_results_alert && this.no_results_alert.remove();
		}
	};

	function Plugin(element, options) {
		this.element   = $(element);
		this.options   = $.extend({}, defaults, options);
		this._defaults = defaults;

		this.init();
	}

	$.extend(Plugin.prototype, {
		init: function () {
			if (this.options.match_method == 'dom') {
				this.element_children = this.element.children().clone(true);
			} else {
				this.element_children = this.element.children();
			}

			this.search_terms = '';

			this._render();

			return this;
		},
		_render: function() {
			this.element.addClass(this.options.active_class);

			// We don't need to build a search form if using external
			if (this.options.form_input !== null) {
				this.input = $(this.options.form_input);
			} else {
				this.search_form = $();
				this.input = $();

				this._insert_search_form();
			}

			this._loaditems();

			this.options.rendered.call(this);

			return this;
		},
		_loaditems: function() {
			this.items = this.element_children
				.removeClass(this.options.match_class)
				.filter(this.options.item_filter);

			this.search(this.search_terms);

			return this;
		},
		filter: function(filter) {
			this.options.item_filter = filter;
			this._loaditems();

			return this;
		},
		_search_init: function() {
			this._sync_inputs(this.search_terms);

			if (this.match_method == 'dom') {
				this.element.children().remove();
			}

			this.num_results = 0;
			this.matches = $();
			this.element.removeClass(this.options.no_matches_class);

			this.options.search_init.call(this, this.search_terms);
		},
		_match: function(elm) {
			if (this.options.match_method == 'dom') {
				elm.clone(true).addClass(this.options.match_class).appendTo(this.element);
			} else {
				elm.addClass(this.options.match_class);
			}
		},
		_no_match: function(elm) {
			if (this.options.match_method == 'dom') {
				elm.remove();
			} else {
				elm.removeClass(this.options.match_class);
			}
		},
		_search_complete: function() {
			if (this.num_results > 0) {
				this.matches = this.element.children().filter('.' + this.options.match_class);
				this.element.removeClass(this.options.no_matches_class);
				this.options.matches.call(this, this.matches, this.search_terms);
			} else {
				this.matches = $();
				this.element.addClass(this.options.no_matches_class);
				this.options.no_matches.call(this, this.search_terms);
			}

			this.options.search_complete.call(this);
		},
		_search: function() {
			this._search_init();

			if (this.search_terms) {
				var regex = new RegExp(this.search_terms, 'i');

				var $plugin = this;
				$plugin.items.filter(function () {
					var text = $plugin.options.item_text.call($(this));
					if (regex.test(text)) {
						$plugin._match($(this));
						$plugin.num_results ++;
					} else {
						$plugin._no_match($(this));
					}
				});
			} else {
				this.num_results = this.items.length;
				this._match(this.items);
			}

			this._search_complete();

			return this;
		},
		search: function(val) {
			this.search_terms = val;
			return this._search();
		},
		reset: function() {
			return this.search('');
		},
		_sync_inputs: function(val) {
			if (!this.input) {
				return this;
			}

			this.input.val(val);

			return this;
		},
		_build_input: function() {
			var input = $(this.options.input_template);

			var $plugin = this;

			input.on('keyup', function(e) {
				clearTimeout($plugin.typing_timer);
				var input = $(this);
				$plugin.typing_timer = setTimeout(function() {
					// If the search terms are still the same
					if (input.val() == $plugin.search_terms) {
						return;
					}

					if (input.val().length >= $plugin.options.min_chars) {
						return input.trigger('search');
					}

					if (input.val() == '') {
						return $plugin.reset();
					}
				}, $plugin.options.typing_threshold);
			});

			input.on('keydown', function(e) {
				clearTimeout($plugin.typing_timer);
			});

			// input.on('click', function(e) { });
			// input.on('input', function(e) { });
			input.on('search', function(e) {
				$plugin.search($(this).val());
			});

			return input;
		},
		_build_search_form: function() {
			var search_form = $('<form>').addClass(this.options.form_class);

			search_form.on('submit', function(e) {
				e.preventDefault();
			});

			if (this.options.label) {
				var label = $(this.options.label_template).text(this.options.label);
				search_form.append(label);
			}

			var input = this._build_input();

			if (this.options.label && this.options.wrap_label) {
				label.append(input);
			} else {
				search_form.append(input);
			}

			this.input = this.input.add(input);
			this.search_form = this.search_form.add(search_form);

			return search_form;
		},
		_insert_search_form: function(search_location) {
			search_location = search_location ? search_location : this.options.search_location;

			if (search_location instanceof jQuery) {
				var $plugin = this;
				search_location.each(function() {
					$(this).append($plugin._build_search_form());
				});
			} else {
				var search_form;

				switch (search_location) {
					case 'before':
						search_form = this._build_search_form().addClass(this.options.form_class + '-before');
						this.element.before(search_form);
						break;
					case 'after':
						search_form = this._build_search_form().addClass(this.options.form_class + '-after');
						this.element.after(search_form);
						break;
					case 'both':
						this._insert_search_form('before');
						this._insert_search_form('after');
						return this;
						break;
					default:
						return this;
						break;
				}
			}

			return this;
		},
		reload: function() {
			this._remove();
			this._render();

			return this;
		},
		_remove_search_form: function() {
			this.search_form.remove();
			return this;
		},
		_remove: function() {
			this.element.removeClass(this.options.active_class)
			            .removeClass(this.options.no_matches_class)
			            .children()
			            .removeClass(this.options.match_class);
			this._remove_search_form();
			return this;
		},
		// Also removes plugin reference from this.element
		// Additional functionality below
		destroy: function() {
			this._remove();
			this.options.destroyed.call(this);
		}
	});

	var plugin_name = 'searchify';

	$.fn[plugin_name] = function(options) {
		var args = arguments;

		if (options === undefined || typeof options === 'object') {
			return this.each(function () {
				if (!$.data(this, 'plugin_' + plugin_name)) {
					$.data(this, 'plugin_' + plugin_name, new Plugin(this, options));
				}
			});
		} else if (typeof options === 'string' && options[0] !== '_' && options !== 'init') {
			var returns;

			this.each(function() {
				var instance = $.data(this, 'plugin_' + plugin_name);

				if (instance instanceof Plugin && typeof instance[options] === 'function') {
					returns = instance[options].apply( instance, Array.prototype.slice.call(args, 1));
				}

				if (options === 'destroy') {
					$.data(this, 'plugin_' + plugin_name, null);
				}
			});

			return returns !== undefined ? returns : this;
		}
	};

}(jQuery, window, document));
